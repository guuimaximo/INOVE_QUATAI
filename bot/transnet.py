# bot/transnet.py
# Camada compartilhada do TransNet (login + relatório de Entradas e Saídas Acumuladas + parse CSV).
# Usado pelo bot diario e pelo bot semanal.

from __future__ import annotations

import os
import shutil
import time
from pathlib import Path

from selenium import webdriver
from selenium.webdriver.common.by import By
from selenium.webdriver.common.keys import Keys
from selenium.webdriver.chrome.service import Service
from selenium.webdriver.chrome.options import Options
from selenium.webdriver.common.action_chains import ActionChains
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC

import pandas as pd

def _env(name: str, default: str = "") -> str:
    """os.environ.get tratando string vazia como ausente (GitHub Actions seta '' quando o secret nao existe)."""
    val = os.environ.get(name, "")
    return val if val else default


TRANSNET_URL = _env(
    "TRANSNET_URL",
    "https://transnet.grupocsc.com.br/sgtweb/index.php?c=controleAcesso.CLogin&m=verTelaLogin",
)
TRANSNET_USER = _env("TRANSNET_USER", "")
TRANSNET_PASSWORD = _env("TRANSNET_PASSWORD", "")
TRANSNET_ALMOXARIFADO = _env("TRANSNET_ALMOXARIFADO", "046")

HEADLESS = _env("HEADLESS", "true").lower() not in ("0", "false", "no")
TIMEOUT_SEC = int(_env("BOT_DOWNLOAD_TIMEOUT", "240"))  # 4 min — se passar disso, abortamos e subimos artefato
POLL_INTERVAL = 0.5
DEBUG_SHOT_EVERY = float(_env("DEBUG_SHOT_INTERVAL", "15"))


def _log(step: str, msg: str = ""):
    print(f"[transnet] {step:>10}  {msg}", flush=True)

BASE_DIR = Path(__file__).resolve().parent
OUT_DIR = (BASE_DIR / "downloads").resolve()
OUT_DIR.mkdir(parents=True, exist_ok=True)

HEADER_START_LINE = 16  # cabeçalho real do CSV exportado pelo TransNet
SKIPROWS = HEADER_START_LINE - 1


def br_to_float(s) -> float:
    """Converte '70,000' -> 70.0 (pt-BR)."""
    if isinstance(s, (int, float)) and not isinstance(s, bool):
        return float(s)
    raw = str(s).strip().replace("\xa0", "").replace(" ", "")
    raw = raw.replace(".", "").replace(",", ".")
    if raw.startswith("(") and raw.endswith(")"):
        raw = "-" + raw[1:-1]
    try:
        return float(raw)
    except Exception:
        return 0.0


def _snapshot(dir_path: Path) -> dict:
    return {p.name: p.stat().st_size for p in dir_path.glob("*") if p.is_file()}


def _wait_for_new_csv(dir_path: Path, before: dict, driver=None, timeout: int = TIMEOUT_SEC) -> Path:
    deadline = time.time() + timeout
    candidate = None
    last_size = -1
    stable = 0
    last_shot = 0.0
    while time.time() < deadline:
        # snapshot atual da pasta a cada 5s
        if time.time() - last_shot >= DEBUG_SHOT_EVERY:
            try:
                files_dbg = [f"{p.name}({p.stat().st_size}b)" for p in dir_path.glob("*") if p.is_file()]
                _log("wait", f"t={int(time.time() - (deadline - timeout))}s pasta={files_dbg}")
                if driver is not None:
                    shot = dir_path / f"wait_{int(time.time())}.png"
                    driver.save_screenshot(str(shot))
                    html = dir_path / f"wait_{int(time.time())}.html"
                    html.write_text(driver.page_source or "", encoding="utf-8", errors="ignore")
                    _log("wait", f"screenshot+html: {shot.name}")
            except Exception as e:
                _log("wait", f"erro snapshot: {e}")
            last_shot = time.time()

        files = sorted(dir_path.glob("*"), key=lambda p: p.stat().st_mtime, reverse=True)
        for p in files:
            if p.name.endswith(".crdownload"):
                candidate = None
                stable = 0
                continue
            if p.name not in before and p.is_file() and p.suffix.lower() == ".csv":
                size = p.stat().st_size
                if candidate is not None and p.samefile(candidate):
                    if size == last_size:
                        stable += 1
                        if stable >= 2:
                            return p
                    else:
                        stable = 0
                    last_size = size
                else:
                    candidate = p
                    last_size = size
                    stable = 0
        time.sleep(POLL_INTERVAL)
    raise TimeoutError(f"CSV não chegou em {timeout}s")


def _make_driver() -> webdriver.Chrome:
    options = Options()
    if HEADLESS:
        options.add_argument("--headless=new")
        options.add_argument("--disable-gpu")
    options.add_argument("--no-sandbox")
    options.add_argument("--disable-dev-shm-usage")
    options.add_argument("--window-size=1920,1080")
    options.add_experimental_option(
        "prefs",
        {
            "download.default_directory": str(OUT_DIR),
            "download.prompt_for_download": False,
            "download.directory_upgrade": True,
            "safebrowsing.enabled": True,
        },
    )
    chrome_bin = _env("CHROME_BIN")
    if chrome_bin:
        options.binary_location = chrome_bin
        _log("driver", f"binary_location={chrome_bin}")

    chromedriver_path = _env("CHROMEDRIVER_PATH")
    if chromedriver_path:
        _log("driver", f"usando chromedriver fornecido em {chromedriver_path}")
        service = Service(chromedriver_path)
    else:
        _log("driver", "usando Selenium Manager (sem service explicito)")
        service = None

    _log("driver", "construindo webdriver.Chrome...")
    driver = webdriver.Chrome(options=options, service=service) if service else webdriver.Chrome(options=options)
    _log("driver", "Chrome iniciado.")
    return driver


def gerar_estoque_virtual_csv(data_ini: str, data_fim: str, nome_saida: str) -> str:
    """data_ini/data_fim no formato DDMMYYYY."""
    _log("STEP 0", f"data_ini={data_ini}  data_fim={data_fim}  arquivo_destino={nome_saida}")
    _log("STEP 0", f"TRANSNET_URL={'<vazia>' if not TRANSNET_URL else TRANSNET_URL[:60]+'...'}")
    _log("STEP 0", f"TRANSNET_USER={'<vazio>' if not TRANSNET_USER else '***' + TRANSNET_USER[-3:]}  almoxarifado={TRANSNET_ALMOXARIFADO}")

    if not TRANSNET_URL:
        raise RuntimeError("Secret TRANSNET_URL vazio. Cadastra a URL completa OU deixa em branco (sem secret).")
    if not TRANSNET_USER or not TRANSNET_PASSWORD:
        raise RuntimeError("Secrets TRANSNET_USER/TRANSNET_PASSWORD não definidos.")

    _log("STEP 1", "abrindo Chrome (headless={})".format(HEADLESS))
    driver = _make_driver()
    wait = WebDriverWait(driver, 30)
    try:
        try:
            driver.execute_cdp_cmd(
                "Page.setDownloadBehavior",
                {"behavior": "allow", "downloadPath": str(OUT_DIR)},
            )
        except Exception as e:
            _log("STEP 1", f"setDownloadBehavior ignorado: {e}")

        _log("STEP 2", "navegando para a tela de login")
        driver.get(TRANSNET_URL)

        _log("STEP 3", "preenchendo login")
        wait.until(EC.visibility_of_element_located((By.ID, "edtLogin"))).send_keys(TRANSNET_USER)
        wait.until(EC.visibility_of_element_located((By.ID, "edtSenha"))).send_keys(TRANSNET_PASSWORD)
        wait.until(EC.element_to_be_clickable((By.XPATH, "//input[@value='ENTRAR']"))).click()
        time.sleep(2)

        _log("STEP 4", "abrindo relatório 'Entradas e Saídas Acumuladas'")
        campo = wait.until(EC.visibility_of_element_located((By.ID, "pesquisaMenu")))
        campo.clear()
        campo.send_keys("Entradas e Saídas Acumuladas")
        time.sleep(2)
        achou = False
        for item in driver.find_elements(By.CSS_SELECTOR, "li"):
            if "Suprimentos - Entradas e Saídas Acumuladas" in item.text:
                driver.execute_script("arguments[0].scrollIntoView()", item)
                item.click()
                achou = True
                break
        if not achou:
            raise RuntimeError("Não achei o item 'Suprimentos - Entradas e Saídas Acumuladas' no menu.")
        driver.switch_to.default_content()
        time.sleep(5)

        _log("STEP 5", f"preenchendo formulário: almoxarifado={TRANSNET_ALMOXARIFADO} periodo={data_ini}->{data_fim}")

        # Reafirma o download behavior após navegar para a tela do relatório
        try:
            driver.execute_cdp_cmd(
                "Page.setDownloadBehavior",
                {"behavior": "allow", "downloadPath": str(OUT_DIR)},
            )
            driver.execute_cdp_cmd(
                "Browser.setDownloadBehavior",
                {"behavior": "allow", "downloadPath": str(OUT_DIR)},
            )
        except Exception as e:
            _log("STEP 5", f"setDownloadBehavior pós-nav ignorado: {e}")

        before = _snapshot(OUT_DIR)
        ac = ActionChains(driver)
        ac.send_keys(TRANSNET_ALMOXARIFADO)
        ac.perform()
        time.sleep(1)
        seq = (
            [Keys.TAB] * 7
            + [Keys.ARROW_DOWN]
            + [Keys.TAB] * 2
            + [data_ini, Keys.TAB, data_fim]
            + [Keys.TAB, Keys.ARROW_DOWN]
            + [Keys.TAB] * 7
            + [Keys.ARROW_DOWN] * 4
            + [Keys.ARROW_UP]
            + [Keys.ENTER] * 3
        )
        for key in seq:
            ac.send_keys(key)
        ac.perform()

        # Screenshot + HTML pós-form pra você ver se a tela mudou
        try:
            shot = OUT_DIR / "pos_form.png"
            driver.save_screenshot(str(shot))
            html = OUT_DIR / "pos_form.html"
            html.write_text(driver.page_source or "", encoding="utf-8", errors="ignore")
            _log("STEP 5", f"snapshot pos-form salvo: {shot.name}, {html.name}")
        except Exception as e:
            _log("STEP 5", f"snapshot pos-form falhou: {e}")

        _log("STEP 6", f"aguardando CSV em {OUT_DIR} (timeout {TIMEOUT_SEC}s, screenshots a cada {DEBUG_SHOT_EVERY}s)")
        novo = _wait_for_new_csv(OUT_DIR, before, driver=driver)
        destino = OUT_DIR / nome_saida
        if destino.exists():
            destino.unlink()
        shutil.move(str(novo), destino)
        _log("STEP 7", f"CSV salvo: {destino}")
        return str(destino)
    except Exception as e:
        _log("ERRO ", f"falhou em {type(e).__name__}: {e}")
        try:
            shot = OUT_DIR / f"erro_{int(time.time())}.png"
            driver.save_screenshot(str(shot))
            _log("ERRO ", f"screenshot salvo em {shot}")
        except Exception:
            pass
        raise
    finally:
        driver.quit()


def tratar_estoque_virtual(caminho_csv: str) -> pd.DataFrame:
    raw = pd.read_csv(
        caminho_csv,
        sep=";",
        encoding="latin1",
        engine="python",
        header=0,
        skiprows=SKIPROWS,
        dtype=str,
        on_bad_lines="skip",
    )
    raw.columns = raw.columns.str.strip()

    if "Produtos" in raw.columns and "Codigo da peça" not in raw.columns:
        extra = raw["Produtos"].astype(str).str.extract(r"(\d+)\s*-\s*(.*)")
        raw["Codigo da peça"] = extra[0]
        raw["Descricao"] = extra[1]

    if "Codigo da peça" not in raw.columns and "Codigo" in raw.columns:
        raw.rename(columns={"Codigo": "Codigo da peça"}, inplace=True)
    if "Codigo da peça" not in raw.columns:
        raise ValueError(f"{caminho_csv}: não encontrei coluna de código.")

    for col in ["Saldo Ant.", "Qtd. Entrada", "Qtd. Saída", "Qtd. Saida", "Saldo"]:
        if col in raw.columns:
            raw[col] = raw[col].apply(br_to_float)

    if "Qtd. Saída" not in raw.columns and "Qtd. Saida" in raw.columns:
        raw.rename(columns={"Qtd. Saida": "Qtd. Saída"}, inplace=True)

    raw["Codigo da peça"] = (
        raw["Codigo da peça"]
        .astype(str)
        .str.extract(r"(\d+)")[0]
        .fillna("")
        .apply(lambda x: x.zfill(6))
    )

    if "Produtos" in raw.columns:
        raw = raw[~raw["Produtos"].astype(str).str.contains(r"(?i)total geral|^total:", regex=True, na=False)]

    keep = ["Codigo da peça", "Descricao", "Saldo Ant.", "Qtd. Entrada", "Qtd. Saída", "Saldo"]
    keep = [c for c in keep if c in raw.columns]
    return raw[keep].dropna(subset=["Codigo da peça"])
