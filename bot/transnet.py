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
from webdriver_manager.chrome import ChromeDriverManager

import pandas as pd

TRANSNET_URL = os.environ.get(
    "TRANSNET_URL",
    "https://transnet.grupocsc.com.br/sgtweb/index.php?c=controleAcesso.CLogin&m=verTelaLogin",
)
TRANSNET_USER = os.environ.get("TRANSNET_USER", "")
TRANSNET_PASSWORD = os.environ.get("TRANSNET_PASSWORD", "")
TRANSNET_ALMOXARIFADO = os.environ.get("TRANSNET_ALMOXARIFADO", "046")

HEADLESS = os.environ.get("HEADLESS", "true").lower() not in ("0", "false", "no")
TIMEOUT_SEC = int(os.environ.get("BOT_DOWNLOAD_TIMEOUT", "600"))
POLL_INTERVAL = 0.5

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


def _wait_for_new_csv(dir_path: Path, before: dict, timeout: int = TIMEOUT_SEC) -> Path:
    deadline = time.time() + timeout
    candidate = None
    last_size = -1
    stable = 0
    while time.time() < deadline:
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
    chrome_bin = os.environ.get("CHROME_BIN")
    if chrome_bin:
        options.binary_location = chrome_bin

    chromedriver_path = os.environ.get("CHROMEDRIVER_PATH")
    service = Service(chromedriver_path) if chromedriver_path else Service(ChromeDriverManager().install())
    return webdriver.Chrome(service=service, options=options)


def gerar_estoque_virtual_csv(data_ini: str, data_fim: str, nome_saida: str) -> str:
    """data_ini/data_fim no formato DDMMYYYY (igual main.py atual)."""
    if not TRANSNET_USER or not TRANSNET_PASSWORD:
        raise RuntimeError("TRANSNET_USER / TRANSNET_PASSWORD não definidos no ambiente.")

    driver = _make_driver()
    wait = WebDriverWait(driver, 30)
    try:
        try:
            driver.execute_cdp_cmd(
                "Page.setDownloadBehavior",
                {"behavior": "allow", "downloadPath": str(OUT_DIR)},
            )
        except Exception:
            pass

        driver.get(TRANSNET_URL)
        wait.until(EC.visibility_of_element_located((By.ID, "edtLogin"))).send_keys(TRANSNET_USER)
        wait.until(EC.visibility_of_element_located((By.ID, "edtSenha"))).send_keys(TRANSNET_PASSWORD)
        wait.until(EC.element_to_be_clickable((By.XPATH, "//input[@value='ENTRAR']"))).click()
        time.sleep(2)

        campo = wait.until(EC.visibility_of_element_located((By.ID, "pesquisaMenu")))
        campo.clear()
        campo.send_keys("Entradas e Saídas Acumuladas")
        time.sleep(2)
        for item in driver.find_elements(By.CSS_SELECTOR, "li"):
            if "Suprimentos - Entradas e Saídas Acumuladas" in item.text:
                driver.execute_script("arguments[0].scrollIntoView()", item)
                item.click()
                break
        driver.switch_to.default_content()
        time.sleep(5)

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
            + [Keys.ARROW_DOWN] * 3
            + [Keys.ENTER] * 3
        )
        for key in seq:
            ac.send_keys(key)
        ac.perform()

        novo = _wait_for_new_csv(OUT_DIR, before)
        destino = OUT_DIR / nome_saida
        if destino.exists():
            destino.unlink()
        shutil.move(str(novo), destino)
        return str(destino)
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
