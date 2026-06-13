# bot/bot_sr_aberta.py
# Le SRs com situacao "Nao Atendida" no TransNet (do dia) e popula
# public.solicitacao_reparo_aberta no Supabase. Cron de 5 em 5 min.

from __future__ import annotations

import os
import re
import sys
import time
from datetime import datetime, date
from urllib.parse import urlparse

from selenium import webdriver
from selenium.webdriver.common.by import By
from selenium.webdriver.chrome.options import Options
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC

from supabase import create_client


# ---------- ENV ----------

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


# ---------- Classificacao Mecanica x Eletrica ----------
# Definicao do Guilherme (12/06/2026). Comparacao case-insensitive
# e ignorando espacos extras.

ELETRICA_MOTIVOS = {
    "AR CONDICIONADO",
    "BANCOS",
    "CAPOTARIA",
    "CARROCERIA",
    "CONSERTO/REPARO DE ROLETA",
    "CONSERTO/REPARO DE TACOGRAFO",
    "ELETRONICA",
    "ELEVADOR",
    "ELETRICA",
    "ITINERARIO",
    "LANTERNAGEM",
    "LIMPEZA EXTERNA",
    "LIMPEZA INTERNA",
    "PARABRISA ARANHADO",
    "PARABRISA QUEBRADO",
    "PARABRISA TRINCADO",
    "PLACA ITINERARIO",
    "PORTAS",
    "RETROVISOR QUEBRADO",
    "SISTEMA DE GRAVACAO",
    "SISTEMA DE RASTREAMENT",
    "VIDRO JANELA QUEBRADO",
}


def _norm_motivo(s: str) -> str:
    if not s:
        return ""
    import unicodedata
    nfkd = unicodedata.normalize("NFKD", s)
    no_acc = "".join(c for c in nfkd if not unicodedata.combining(c))
    return re.sub(r"\s+", " ", no_acc).strip().upper()


def classificar(motivo: str) -> str:
    return "eletrica" if _norm_motivo(motivo) in ELETRICA_MOTIVOS else "mecanica"


def extrair_prefixo(equipamento: str) -> str:
    # "046 - 221602" -> "221602"
    if not equipamento:
        return ""
    parts = [p.strip() for p in equipamento.split("-")]
    return parts[-1] if parts else equipamento.strip()


# ---------- Selenium ----------

def log(step: str, msg: str = ""):
    print(f"[sr_aberta] {step:>10}  {msg}", flush=True)


def make_driver() -> webdriver.Chrome:
    opts = Options()
    if HEADLESS:
        opts.add_argument("--headless=new")
    opts.add_argument("--no-sandbox")
    opts.add_argument("--disable-dev-shm-usage")
    opts.add_argument("--disable-gpu")
    opts.add_argument("--window-size=1600,1000")
    if CHROME_BIN:
        opts.binary_location = CHROME_BIN
    return webdriver.Chrome(options=opts)


def login(driver: webdriver.Chrome):
    wait = WebDriverWait(driver, 30)
    log("login", "abrindo tela de login")
    driver.get(TRANSNET_URL)
    wait.until(EC.visibility_of_element_located((By.ID, "edtLogin"))).send_keys(TRANSNET_USER)
    wait.until(EC.visibility_of_element_located((By.ID, "edtSenha"))).send_keys(TRANSNET_PASSWORD)
    wait.until(EC.element_to_be_clickable((By.XPATH, "//input[@value='ENTRAR']"))).click()
    time.sleep(2)


def base_url() -> str:
    p = urlparse(TRANSNET_URL)
    path = p.path
    if "/index.php" in path:
        path = path.split("/index.php")[0] + "/"
    return f"{p.scheme}://{p.netloc}{path}"


def listar_srs_abertas_hoje(driver: webdriver.Chrome) -> list[dict]:
    """
    Carrega a listagem padrao (mais recentes) e filtra em Python pelas
    SRs com situacao 'Nao Atendida' (= em aberto).
    """
    wait = WebDriverWait(driver, 30)

    url_lista = (
        base_url()
        + "index.php?c=frota.manutencao.reclamacao.CReclamacoes"
        + "&m=verTodosPaginado&idFuncaoLog=501"
    )
    log("lista", f"abrindo {url_lista}")
    driver.get(url_lista)

    # A tela exige clicar em "Pesquisar" pra popular registros.
    # Setamos nrPaginador=1500 (limite max) e filtro csReclamacao=N (Nao Atendida).
    log("lista", "pesquisa inicial + ajusta paginador=1500")
    try:
        wait.until(EC.presence_of_element_located((By.CSS_SELECTOR, "table[id^='listavreclamacoes']")))
        # Filtro Nao Atendida e primeira pesquisa (popula paginador).
        driver.execute_script(
            "const f = document.formulario; if (f && f.csReclamacao) f.csReclamacao.value = 'N';"
            "pesquisar(true, 1, 1);"
        )
        # Espera o paginador aparecer.
        WebDriverWait(driver, 15).until(
            EC.presence_of_element_located((By.NAME, "nrPaginador"))
        )
        # Agora muda o limite pra 1500 (focus + change + blur dispara paginar()).
        np = driver.find_element(By.NAME, "nrPaginador")
        np.click()
        time.sleep(0.3)
        np.clear()
        np.send_keys("1500")
        driver.execute_script(
            "const np = arguments[0]; np.blur(); if (np.onblur) np.onblur();", np,
        )
        time.sleep(4)  # AJAX paginar+pesquisar
    except Exception as e:
        log("lista", f"falha paginar+pesquisar: {e}")

    # Aguarda registros (linhas com class linha1/linha2 surgirem).
    def _tem_linhas(d):
        return len(d.find_elements(
            By.CSS_SELECTOR,
            "table[id^='listavreclamacoes'] tr.linha1, table[id^='listavreclamacoes'] tr.linha2",
        )) > 0

    try:
        WebDriverWait(driver, 20).until(_tem_linhas)
    except Exception:
        log("lista", "tabela continua sem registros")
        return []

    rows_raw = driver.find_elements(
        By.CSS_SELECTOR,
        "table[id^='listavreclamacoes'] tr.linha1, table[id^='listavreclamacoes'] tr.linha2",
    )
    log("lista", f"linhas brutas: {len(rows_raw)}")

    # DEBUG: salva pagina pra inspecao
    try:
        from pathlib import Path
        dump = Path(__file__).parent / "downloads" / "sr_aberta_debug.html"
        dump.write_text(driver.page_source or "", encoding="utf-8", errors="ignore")
        log("lista", f"debug html: {dump}")
    except Exception:
        pass

    out: list[dict] = []
    for tr in rows_raw:
        tds = tr.find_elements(By.TAG_NAME, "td")
        if len(tds) < 6:
            continue
        try:
            href = tds[0].find_element(By.TAG_NAME, "a").get_attribute("href") or ""
        except Exception:
            href = ""
        m = re.search(r"idReclamacao=(\d+)", href)
        if not m:
            continue
        id_rec = int(m.group(1))

        codigo = tds[1].text.strip()
        usuario = tds[2].text.strip()
        equipamento = tds[3].text.strip()
        situacao = tds[4].text.strip()
        data_txt = tds[5].text.strip()

        # Filtra apenas SRs com situacao "Nao Atendida" (em aberto),
        # independente da data de abertura.
        try:
            data_iso = datetime.strptime(data_txt, "%d/%m/%Y").date().isoformat()
        except ValueError:
            data_iso = None
        if "nao atendida" not in _norm_motivo(situacao).lower():
            continue

        out.append({
            "id_reclamacao": id_rec,
            "codigo": codigo or str(id_rec),
            "usuario_cadastro": usuario,
            "equipamento": equipamento,
            "prefixo": extrair_prefixo(equipamento),
            "situacao": situacao,
            "data_abertura": data_iso,
        })

    log("lista", f"SRs em aberto hoje: {len(out)}")
    return out


def pegar_detalhe(driver: webdriver.Chrome, id_reclamacao: int) -> dict:
    """Abre verAlterar e extrai dsObservacao + texto do motivo selecionado."""
    url = (
        base_url()
        + f"index.php?c=frota.manutencao.reclamacao.CReclamacoes"
        + f"&m=verAlterar&idReclamacao={id_reclamacao}"
    )
    driver.get(url)
    try:
        WebDriverWait(driver, 15).until(
            EC.presence_of_element_located((By.NAME, "dsObservacao"))
        )
    except Exception:
        return {"observacao": "", "motivo": ""}

    obs = ""
    motivo = ""
    try:
        obs = driver.find_element(By.NAME, "dsObservacao").get_attribute("value") or ""
    except Exception:
        pass
    try:
        # text do option selecionado em idMotivoReclamacao
        motivo = driver.execute_script(
            "const s=document.getElementsByName('idMotivoReclamacao')[0];"
            "if(!s) return '';"
            "const o=s.options[s.selectedIndex];"
            "return o ? o.text : '';"
        ) or ""
    except Exception:
        pass
    return {"observacao": obs.strip(), "motivo": motivo.strip()}


def upsert(sb, srs: list[dict]):
    if not srs:
        return
    agora = datetime.utcnow().isoformat()
    payload = [{**s, "ultima_consulta": agora} for s in srs]
    log("upsert", f"{len(payload)} linhas")
    sb.table("solicitacao_reparo_aberta").upsert(
        payload,
        on_conflict="id_reclamacao",
    ).execute()


def main():
    if not (TRANSNET_USER and TRANSNET_PASSWORD):
        sys.exit("ENV faltando: TRANSNET_USER / TRANSNET_PASSWORD")
    if not (SUPABASE_URL and SUPABASE_SERVICE_KEY):
        sys.exit("ENV faltando: SUPABASE_URL / SUPABASE_SERVICE_KEY")

    sb = create_client(SUPABASE_URL, SUPABASE_SERVICE_KEY)
    driver = make_driver()
    try:
        login(driver)
        srs = listar_srs_abertas_hoje(driver)

        for s in srs:
            det = pegar_detalhe(driver, s["id_reclamacao"])
            s["observacao"] = det["observacao"]
            s["motivo"] = det["motivo"]
            s["categoria"] = classificar(det["motivo"])
            log("detalhe", f"id={s['id_reclamacao']} motivo={det['motivo']!r} cat={s['categoria']}")

        upsert(sb, srs)
        log("fim", f"ok ({len(srs)} SRs)")
    finally:
        try:
            driver.quit()
        except Exception:
            pass


if __name__ == "__main__":
    main()
