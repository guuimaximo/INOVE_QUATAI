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
from selenium.webdriver.chrome.service import Service
from selenium.webdriver.chrome.options import Options
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


def _ddmmyyyy_to_br(data: str) -> str:
    return f"{data[:2]}/{data[2:4]}/{data[4:]}"


def _preencher_relatorio_estoque(driver: webdriver.Chrome, data_ini: str, data_fim: str) -> dict:
    """Preenche o relatorio por DOM, sem depender de foco, TAB ou setas."""
    return driver.execute_script(
        """
        const almoxarifadoAlvo = arguments[0];
        const dataInicial = arguments[1];
        const dataFinal = arguments[2];
        const sep = String.fromCharCode(171, 166, 124, 166, 187);
        const info = {};

        function byId(id) {
            return document.getElementById(id);
        }

        function byName(name) {
            return document.getElementsByName(name)[0] || null;
        }

        function setValue(selector, value) {
            const el = byId(selector) || byName(selector);
            if (!el) {
                info[`missing_${selector}`] = true;
                return false;
            }
            el.value = value;
            el.dispatchEvent(new Event('input', { bubbles: true }));
            el.dispatchEvent(new Event('change', { bubbles: true }));
            return true;
        }

        function hiddenValue(selectId) {
            const select = byId(selectId);
            if (!select) return '';
            const values = Array.from(select.options).map((option) => option.value).filter(Boolean);
            return values.length ? values.join(sep) + sep : '';
        }

        function syncHidden(hiddenId, selectId) {
            const hidden = byId(hiddenId) || byName(hiddenId);
            if (hidden) hidden.value = hiddenValue(selectId);
        }

        function moveAll(fromId, toId) {
            const from = byId(fromId);
            const to = byId(toId);
            if (!from || !to) return 0;
            const options = Array.from(from.options);
            options.forEach((option) => to.appendChild(option));
            return options.length;
        }

        function normalize(value) {
            return String(value || '')
                .normalize('NFD')
                .replace(/[\\u0300-\\u036f]/g, '')
                .toUpperCase()
                .trim();
        }

        function findOption(select, target) {
            const wanted = normalize(target);
            const wantedDigits = String(target || '').replace(/\\D/g, '');
            return Array.from(select.options).find((option) => {
                const text = normalize(option.textContent);
                const value = normalize(option.value);
                const textDigits = text.replace(/\\D/g, '');
                return value === wanted
                    || text.startsWith(`${wanted} -`)
                    || (wantedDigits && textDigits.startsWith(wantedDigits))
                    || text.includes(wanted);
            });
        }

        function findOptionByVisibleCode(select, target) {
            const wanted = normalize(target);
            return Array.from(select.options).find((option) => {
                const text = normalize(option.textContent);
                return text.startsWith(`${wanted} -`);
            });
        }

        function selectOnlyByTarget(leftId, rightId, hiddenLeftId, hiddenRightId, target) {
            const left = byId(leftId);
            const right = byId(rightId);
            if (!left || !right) return { found: false, reason: 'select_missing' };

            const match = findOption(right, target) || findOption(left, target);
            if (!match) {
                syncHidden(hiddenLeftId, leftId);
                syncHidden(hiddenRightId, rightId);
                return {
                    found: false,
                    reason: 'target_not_found',
                    kept: hiddenValue(rightId),
                };
            }

            const pool = document.createElement('select');
            Array.from(left.options).forEach((option) => pool.appendChild(option));
            Array.from(right.options).forEach((option) => pool.appendChild(option));

            Array.from(pool.options).forEach((option) => {
                if (option === match) {
                    right.appendChild(option);
                } else {
                    left.appendChild(option);
                }
            });

            syncHidden(hiddenLeftId, leftId);
            syncHidden(hiddenRightId, rightId);
            return {
                found: Boolean(match),
                value: match ? match.value : '',
                text: match ? match.textContent.trim() : '',
            };
        }

        function selectByTargets(leftId, rightId, hiddenLeftId, hiddenRightId, targets) {
            const left = byId(leftId);
            const right = byId(rightId);
            if (!left || !right) return { found: [], missing: targets, reason: 'select_missing' };

            const matches = [];
            const missing = [];
            targets.forEach((target) => {
                const match = findOptionByVisibleCode(right, target) || findOptionByVisibleCode(left, target);
                if (match) {
                    matches.push(match);
                } else {
                    missing.push(target);
                }
            });

            if (!matches.length) {
                syncHidden(hiddenLeftId, leftId);
                syncHidden(hiddenRightId, rightId);
                return {
                    found: [],
                    missing,
                    kept: hiddenValue(rightId),
                };
            }

            const wanted = new Set(matches);
            const pool = document.createElement('select');
            Array.from(left.options).forEach((option) => pool.appendChild(option));
            Array.from(right.options).forEach((option) => pool.appendChild(option));

            Array.from(pool.options).forEach((option) => {
                if (wanted.has(option)) {
                    right.appendChild(option);
                } else {
                    left.appendChild(option);
                }
            });

            syncHidden(hiddenLeftId, leftId);
            syncHidden(hiddenRightId, rightId);
            return {
                found: matches.map((option) => option.textContent.trim()),
                missing,
            };
        }

        function clearSelected(leftId, rightId, hiddenLeftId, hiddenRightId) {
            const moved = moveAll(rightId, leftId);
            syncHidden(hiddenLeftId, leftId);
            syncHidden(hiddenRightId, rightId);
            return moved;
        }

        info.empresa = selectOnlyByTarget('lstidEmpresa1', 'lstidEmpresa2', 'idEmpresa1', 'idEmpresa2', '046');
        info.almoxarifado = selectOnlyByTarget(
            'lstalmoxarifado1',
            'lstalmoxarifado2',
            'almoxarifado1',
            'almoxarifado2',
            almoxarifadoAlvo
        );

        info.grupos = selectByTargets('lstgrupo1', 'lstgrupo2', 'grupo1', 'grupo2', ['04', '10', '11', '14', '45']);
        info.subgrupos_limpos = clearSelected('lstsubgrupo1', 'lstsubgrupo2', 'subgrupo1', 'subgrupo2');

        setValue('cdProdutoInicial', '00000000000');
        setValue('cdProdutoFinal', '99999999999');
        setValue('dataInicial', dataInicial);
        setValue('dataFinal', dataFinal);
        setValue('tipoRelatorio', 'D');
        setValue('csImprimePmu', 'N');
        setValue('csQuebraSubgrupo', 'N');
        setValue('imprimeProdutosInativos', 'S');
        setValue('imprimeApenasProdutosMovimentados', 'N');
        setValue('imprimeApenasProdutosContabSaida', 'N');
        setValue('qtCasasDecimais', '2');
        setValue('visualizacao', '4');
        setValue('hiddenVis', '4');
        setValue('hiddenEsc', '0');
        setValue('hiddenTam', '1');

        if (typeof preencheValores === 'function') {
            preencheValores();
        }

        info.hidden = {
            empresa: (byId('idEmpresa2') || {}).value || '',
            almoxarifado: (byId('almoxarifado2') || {}).value || '',
            grupo: (byId('grupo2') || {}).value || '',
            subgrupo: (byId('subgrupo2') || {}).value || '',
            visualizacao: (byId('hiddenVis') || {}).value || '',
        };

        const form = document.forms.formulario;
        if (!form) {
            throw new Error('Formulario do relatorio nao encontrado.');
        }
        form.action = '?c=suprimentos.CSuRelatorioEntradasESaidasAcumuladas&itemMenu=4941&m=pesquisar';
        form.submit();
        return info;
        """,
        TRANSNET_ALMOXARIFADO,
        _ddmmyyyy_to_br(data_ini),
        _ddmmyyyy_to_br(data_fim),
    )


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
        info_form = _preencher_relatorio_estoque(driver, data_ini, data_fim)
        _log("STEP 5", f"formulario via DOM: {info_form}")
        time.sleep(1)

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


def _find_header_row(caminho_csv: str) -> int:
    """Acha a linha (0-based) do cabecalho real do CSV TransNet.
    Procura a primeira linha que contem 'Produtos' OU 'Codigo' E tem ';' e 'Saldo'.
    """
    with open(caminho_csv, "r", encoding="latin1", errors="ignore") as f:
        for idx, line in enumerate(f):
            s = line.strip().lower()
            if ";" not in s:
                continue
            if "saldo" in s and ("produtos" in s or "codigo" in s or "código" in s):
                return idx
    raise ValueError(f"{caminho_csv}: não localizei o cabeçalho do relatório.")


def tratar_estoque_virtual(caminho_csv: str) -> pd.DataFrame:
    header_row = _find_header_row(caminho_csv)
    _log("parse", f"cabecalho do CSV detectado na linha {header_row + 1}")

    raw = pd.read_csv(
        caminho_csv,
        sep=";",
        encoding="latin1",
        engine="python",
        header=0,
        skiprows=header_row,
        dtype=str,
        on_bad_lines="skip",
    )
    raw.columns = raw.columns.str.strip()
    _log("parse", f"colunas: {list(raw.columns)[:12]}")
    _log("parse", f"linhas brutas: {len(raw)}")

    if "Produtos" in raw.columns and "Codigo da peça" not in raw.columns:
        extra = raw["Produtos"].astype(str).str.extract(r"(\d+)\s*-\s*(.*)")
        raw["Codigo da peça"] = extra[0]
        raw["Descricao"] = extra[1]

    if "Codigo da peça" not in raw.columns and "Codigo" in raw.columns:
        raw.rename(columns={"Codigo": "Codigo da peça"}, inplace=True)
    if "Codigo da peça" not in raw.columns:
        raise ValueError(f"{caminho_csv}: não encontrei coluna de código (cols={list(raw.columns)})")

    # alguns cabecalhos vem com 'Qtd. Saida' (sem acento) ou 'Qtd. Saída'
    if "Qtd. Saída" not in raw.columns and "Qtd. Saida" in raw.columns:
        raw.rename(columns={"Qtd. Saida": "Qtd. Saída"}, inplace=True)

    for col in ["Saldo Ant.", "Qtd. Entrada", "Qtd. Saída", "Saldo"]:
        if col in raw.columns:
            raw[col] = raw[col].apply(br_to_float)

    raw["Codigo da peça"] = (
        raw["Codigo da peça"]
        .astype(str)
        .str.extract(r"(\d+)")[0]
        .fillna("")
        .apply(lambda x: x.zfill(6))
    )

    # remove linhas de totalizacao (Total Grupo:, Total Subgrupo:, Total Geral, etc.)
    if "Produtos" in raw.columns:
        raw = raw[~raw["Produtos"].astype(str).str.contains(r"(?i)total\s+(geral|grupo|subgrupo)|^total:", regex=True, na=False)]

    keep = ["Codigo da peça", "Descricao", "Saldo Ant.", "Qtd. Entrada", "Qtd. Saída", "Saldo"]
    keep = [c for c in keep if c in raw.columns]
    out = raw[keep].dropna(subset=["Codigo da peça"])
    # remove codigo vazio (linhas que cairam aqui mas nao eram produto)
    out = out[out["Codigo da peça"].str.replace("0", "") != ""]
    _log("parse", f"linhas validas apos limpeza: {len(out)}")
    return out
