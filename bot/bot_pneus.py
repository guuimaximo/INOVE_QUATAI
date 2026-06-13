# bot/bot_pneus.py
# Disparado pelo INOVE (Edge Function dispatch-bot, tipo="pneus").
# Login no TransNet -> baixa 3 relatorios em CSV -> upsert no Supabase nas 3
# tabelas snapshot que alimentam a view vw_pcm_controle_pneus_central.

from __future__ import annotations

import csv
import os
import re
import sys
import time
from datetime import datetime
from pathlib import Path

from selenium import webdriver
from selenium.webdriver.common.by import By
from selenium.webdriver.chrome.options import Options
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC

from supabase import create_client


# ---------------- ENV ----------------
def _env(name: str, default: str = "") -> str:
    val = os.environ.get(name, "")
    return val if val else default


TRANSNET_URL = _env(
    "TRANSNET_URL",
    "https://transnet.grupocsc.com.br/sgtweb/index.php?c=controleAcesso.CLogin&m=verTelaLogin",
)
TRANSNET_USER = _env("TRANSNET_USER", "")
TRANSNET_PASSWORD = _env("TRANSNET_PASSWORD", "")
SUPABASE_URL = _env("SUPABASE_URL", "")
SUPABASE_SERVICE_KEY = _env("SUPABASE_SERVICE_KEY", "")
HEADLESS = _env("HEADLESS", "true").lower() not in ("0", "false", "no")
CHROME_BIN = _env("CHROME_BIN", "")
EMPRESA_CODIGO = _env("TRANSNET_EMPRESA", "046")

BASE_DIR = Path(__file__).resolve().parent
DOWNLOAD_DIR = (BASE_DIR / "downloads").resolve()
DOWNLOAD_DIR.mkdir(parents=True, exist_ok=True)


def log(step: str, msg: str = ""):
    print(f"[pneus] {step:>10}  {msg}", flush=True)


# ---------------- Selenium ----------------
def make_driver() -> webdriver.Chrome:
    opts = Options()
    if HEADLESS:
        opts.add_argument("--headless=new")
    opts.add_argument("--no-sandbox")
    opts.add_argument("--disable-dev-shm-usage")
    opts.add_argument("--disable-gpu")
    opts.add_argument("--window-size=1600,1000")
    prefs = {
        "download.default_directory": str(DOWNLOAD_DIR),
        "download.prompt_for_download": False,
        "safebrowsing.enabled": True,
    }
    opts.add_experimental_option("prefs", prefs)
    if CHROME_BIN:
        opts.binary_location = CHROME_BIN
    drv = webdriver.Chrome(options=opts)
    try:
        drv.execute_cdp_cmd(
            "Page.setDownloadBehavior",
            {"behavior": "allow", "downloadPath": str(DOWNLOAD_DIR)},
        )
    except Exception:
        pass
    return drv


def login(driver: webdriver.Chrome):
    wait = WebDriverWait(driver, 30)
    log("login", "abrindo tela de login")
    driver.get(TRANSNET_URL)
    wait.until(EC.visibility_of_element_located((By.ID, "edtLogin"))).send_keys(TRANSNET_USER)
    wait.until(EC.visibility_of_element_located((By.ID, "edtSenha"))).send_keys(TRANSNET_PASSWORD)
    wait.until(EC.element_to_be_clickable((By.XPATH, "//input[@value='ENTRAR']"))).click()
    time.sleep(2)


def base_url() -> str:
    from urllib.parse import urlparse
    p = urlparse(TRANSNET_URL)
    path = p.path
    if "/index.php" in path:
        path = path.split("/index.php")[0] + "/"
    return f"{p.scheme}://{p.netloc}{path}"


def listar_downloads_csv_atuais() -> set:
    return {p.name for p in DOWNLOAD_DIR.glob("*.csv")}


def aguardar_csv_novo(antes: set, timeout: int = 120) -> Path:
    """Espera um .csv novo aparecer e ficar com tamanho estavel."""
    deadline = time.time() + timeout
    estavel = 0
    last_size = -1
    candidato: Path | None = None
    while time.time() < deadline:
        atuais = {p.name for p in DOWNLOAD_DIR.glob("*.csv")}
        novos = atuais - antes
        if novos:
            candidato = DOWNLOAD_DIR / sorted(novos)[-1]
            size = candidato.stat().st_size
            if size == last_size and size > 0:
                estavel += 1
                if estavel >= 3:
                    return candidato
            else:
                estavel = 0
                last_size = size
        time.sleep(0.5)
    raise TimeoutError("CSV nao baixou no tempo esperado")


def configurar_empresa(driver: webdriver.Chrome, nome_botao: str):
    """Garante que apenas a empresa configurada esta no select 'Selecionados'.
    Cada relatorio usa nomes diferentes pros componentes — passamos o prefixo."""
    js = f"""
    // Move todos os selecionados pra nao-selecionados
    const sel = document.getElementsByName('lst{nome_botao}2')[0];
    const nsel = document.getElementsByName('lst{nome_botao}1')[0];
    if (!sel || !nsel) return 'no-select';
    while (sel.options.length > 0) {{
      nsel.add(sel.options[0]);
    }}
    // Move so a empresa alvo pra selecionados
    for (let i = nsel.options.length - 1; i >= 0; i--) {{
      if (nsel.options[i].value === '{EMPRESA_CODIGO}') {{
        sel.add(nsel.options[i]);
      }}
    }}
    return 'ok';
    """
    try:
        driver.execute_script(js)
    except Exception as e:
        log("empresa", f"falha ajuste empresa: {e}")


def set_visualizacao_csv(driver: webdriver.Chrome):
    driver.execute_script(
        "const v=document.getElementById('visualizacao'); if(v){v.value='4';} "
        "const hv=document.getElementById('hiddenVis'); if(hv){hv.value='4';}"
    )


def baixar_relatorio(
    driver: webdriver.Chrome,
    url_relatorio: str,
    nome_empresa_form: str,
    botao_pesquisar_xpath: str = "//a[contains(@href,'preencheValores()') and contains(@href,'pesquisar')]",
    extra_setup=None,
) -> Path:
    """Abre o relatorio, configura empresa+CSV, clica em Pesquisar e espera CSV."""
    wait = WebDriverWait(driver, 30)
    log("relatorio", f"abrindo {url_relatorio}")
    driver.get(url_relatorio)
    wait.until(EC.presence_of_element_located((By.NAME, "formulario")))
    time.sleep(1.5)

    configurar_empresa(driver, nome_empresa_form)
    set_visualizacao_csv(driver)

    if extra_setup:
        extra_setup(driver)

    antes = listar_downloads_csv_atuais()
    try:
        btn = wait.until(EC.element_to_be_clickable((By.XPATH, botao_pesquisar_xpath)))
        driver.execute_script("arguments[0].click();", btn)
    except Exception:
        # fallback: chama direto preencheValores + submete o form
        driver.execute_script(
            "preencheValores(); document.formulario.action=window.location.search.replace('verPesquisar','pesquisar'); document.formulario.submit();"
        )
    return aguardar_csv_novo(antes)


# ---------------- Parsers ----------------
POSICOES_VEICULO = {"DD", "DE", "TEE", "TEI", "TDI", "TDE", "STEP"}


def detectar_separador(caminho: Path) -> str:
    with open(caminho, "r", encoding="latin-1", errors="ignore") as f:
        amostra = f.read(4096)
    candidatos = [";", ",", "\t", "|"]
    return max(candidatos, key=lambda s: amostra.count(s))


def parse_pneus_por_veiculo(caminho: Path) -> list[dict]:
    """Parser do CSV "Pneus Por Veiculo": cabecalho 'Posicao,Empresa,Pneu,...'
    intercalado com linhas 'Empresa/Veiculo: 046/221601' separando os blocos."""
    sep = detectar_separador(caminho)
    rows: list[dict] = []
    prefixo_atual: str | None = None
    re_veic = re.compile(r"046/([A-Z0-9]+)", re.I)

    with open(caminho, "r", encoding="latin-1", errors="ignore") as f:
        for raw in csv.reader(f, delimiter=sep):
            if not raw:
                continue
            joined = raw[0]
            m = re_veic.search(joined)
            if m:
                prefixo_atual = m.group(1).strip()
                continue
            if not prefixo_atual:
                continue
            posicao = raw[0].strip().upper()
            if posicao not in POSICOES_VEICULO:
                continue
            # Colunas: Posicao | Empresa | Pneu | Data | KMperc | KMvida | KMtotal | Situacao | Desenho | Marca | Medida | UltRecap
            pneu = raw[2].strip() if len(raw) > 2 else ""
            if not pneu or pneu in ("S/PNEU", "-", "—"):
                continue
            rows.append({
                "prefixo": prefixo_atual,
                "posicao": posicao,
                "numero_fogo": pneu,
            })
    return rows


def parse_localizacao(caminho: Path) -> list[dict]:
    """CSV 'Localizacao de Pneus' — header:
    Emp | Nr. Pneu | Nr. Dot | Km Rodada | Vida Atual | Localizacao | Medida | Marca | Posicao | Desenho
    """
    sep = detectar_separador(caminho)
    rows: list[dict] = []
    header_visto = False
    with open(caminho, "r", encoding="latin-1", errors="ignore") as f:
        for raw in csv.reader(f, delimiter=sep):
            if not raw:
                continue
            primeira = raw[0].strip().lower()
            if not header_visto:
                if primeira == "emp." or primeira == "emp":
                    header_visto = True
                continue
            if len(raw) < 9:
                continue
            try:
                km = float(str(raw[3]).replace(",", ".").strip() or 0)
            except Exception:
                km = 0
            rows.append({
                "numero_fogo": raw[1].strip(),
                "dot": raw[2].strip(),
                "km_rodada": km,
                "vida_atual": raw[4].strip(),
                "localizacao": raw[5].strip(),
                "medida": raw[6].strip(),
                "marca": raw[7].strip(),
                "posicao": raw[8].strip() if len(raw) > 8 else "",
                "desenho": raw[9].strip() if len(raw) > 9 else "",
            })
    return rows


# ---------------- Upsert helpers ----------------
def chunk(seq, n=500):
    for i in range(0, len(seq), n):
        yield seq[i:i + n]


def truncate_and_load(sb, table: str, rows: list[dict]):
    """Apaga tudo e insere — bot rodar inteiro garante consistencia."""
    log("upsert", f"{table}: {len(rows)} linhas")
    sb.table(table).delete().neq("snapshot_em", "1970-01-01T00:00:00Z").execute()
    if not rows:
        return
    agora = datetime.utcnow().isoformat()
    for batch in chunk([{**r, "snapshot_em": agora} for r in rows]):
        sb.table(table).insert(batch).execute()


# ---------------- Main ----------------
def main():
    if not (TRANSNET_USER and TRANSNET_PASSWORD):
        sys.exit("ENV faltando: TRANSNET_USER / TRANSNET_PASSWORD")
    if not (SUPABASE_URL and SUPABASE_SERVICE_KEY):
        sys.exit("ENV faltando: SUPABASE_URL / SUPABASE_SERVICE_KEY")

    sb = create_client(SUPABASE_URL, SUPABASE_SERVICE_KEY)
    driver = make_driver()
    try:
        login(driver)

        # 1) Pneus Por Veiculo
        url_pv = base_url() + "index.php?c=frota.pneu.CRelatorioPneusPorVeiculo&m=verPesquisar"
        csv_pv = baixar_relatorio(driver, url_pv, nome_empresa_form="empresa")
        alocacao = parse_pneus_por_veiculo(csv_pv)
        truncate_and_load(sb, "pcm_pneus_transnet_alocacao", alocacao)

        # 2) Localizacao Ativos (boAtivo=S)
        url_loc = base_url() + "index.php?c=frota.pneu.CRelLocalizacaoPneus&m=verPesquisar"
        def set_ativos(d):
            d.execute_script("const s=document.getElementsByName('boAtivo')[0]; if(s){s.value='S';}")
        csv_at = baixar_relatorio(driver, url_loc, nome_empresa_form="Empresas", extra_setup=set_ativos)
        ativos = parse_localizacao(csv_at)
        truncate_and_load(sb, "pcm_pneus_transnet_ativos", ativos)

        # 3) Localizacao Inativos (boAtivo=N) — so o que precisamos pra SUCATA
        def set_inativos(d):
            d.execute_script("const s=document.getElementsByName('boAtivo')[0]; if(s){s.value='N';}")
        csv_in = baixar_relatorio(driver, url_loc, nome_empresa_form="Empresas", extra_setup=set_inativos)
        inativos_raw = parse_localizacao(csv_in)
        inativos = [
            {"numero_fogo": r["numero_fogo"], "motivo": r.get("localizacao") or ""}
            for r in inativos_raw if r.get("numero_fogo")
        ]
        truncate_and_load(sb, "pcm_pneus_transnet_inativos", inativos)

        log("fim", f"alocacao={len(alocacao)} ativos={len(ativos)} inativos={len(inativos)}")
    finally:
        try:
            driver.quit()
        except Exception:
            pass


if __name__ == "__main__":
    main()
