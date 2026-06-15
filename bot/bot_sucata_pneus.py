# bot/bot_sucata_pneus.py
# Bot LOCAL para sucatear em lote pneus no TransNet.
# Para cada numero de fogo da lista PNEUS:
#   1) pesquisa em sgt/pneu/te_movimentacao.php -> obtem stIdPneu
#   2) na tela de movimentacoes, pega o stIdMovimentacao do link "Incluir"
#   3) abre fm_movimentacaopneu.php e envia POST para un_movimentacaopneu.php
#      com motivo=005 (SUCATEAR), centro=999 (SUCATA), motivo_sucat=017 (NAO VERIFICADO)
#
# Uso (Windows PowerShell, dentro de bot/):
#   .venv\Scripts\Activate.ps1
#   python bot_sucata_pneus.py
#
# Le credenciais de bot/.env (mesmo padrao dos outros bots).

from __future__ import annotations

import os
import re
import sys
import time
from pathlib import Path
from urllib.parse import urlparse

from selenium import webdriver
from selenium.webdriver.common.by import By
from selenium.webdriver.chrome.options import Options
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC

try:
    from dotenv import load_dotenv
    load_dotenv(Path(__file__).resolve().parent / ".env")
except Exception:
    pass


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
HEADLESS = _env("HEADLESS", "false").lower() not in ("0", "false", "no")
CHROME_BIN = _env("CHROME_BIN", "")
EMPRESA = _env("TRANSNET_EMPRESA", "046")

OBSERVACAO = _env("SUCATA_OBSERVACAO", "Sucateamento em lote")
MOTIVO_SUCAT = _env("SUCATA_MOTIVO", "017")  # NAO VERIFICADO
CENTRO_CUSTO = _env("SUCATA_CENTRO", "999")  # SUCATA
DATA_MOV = _env("SUCATA_DATA_MOV", "")
HORA_MOV = _env("SUCATA_HORA_MOV", "")
DRY_RUN = _env("DRY_RUN", "false").lower() in ("1", "true", "yes")


# ---------------- Lista de pneus ----------------
# Numeros de fogo (6 digitos). Editar aqui ou criar bot/sucata_pneus.txt
# (um por linha) que substitui esta lista.
PNEUS_DEFAULT = [
    "001828", "080001",
    "209225", "209268", "209269", "209310", "209338", "209343",
    "209352", "209445",
    "402001", "402003", "402004", "402051", "402112",
    "405013",
    "406005", "406008", "406013",
    "505008",
    "508005", "508019",
    "509131",
    "510008", "510010", "510024", "510028", "510046", "510050", "510070",
    "601001", "601003", "601005", "601006", "601008",
    "800530",
]


def carregar_pneus() -> list[str]:
    arq = Path(__file__).resolve().parent / "sucata_pneus.txt"
    if arq.exists():
        linhas = [l.strip() for l in arq.read_text(encoding="utf-8").splitlines()]
        return [l.zfill(6) for l in linhas if l and not l.startswith("#")]
    return [p.zfill(6) for p in PNEUS_DEFAULT]


# ---------------- Selenium ----------------
def log(step: str, msg: str = ""):
    print(f"[sucata] {step:>10}  {msg}", flush=True)


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


def base_origin() -> str:
    p = urlparse(TRANSNET_URL)
    return f"{p.scheme}://{p.netloc}"


PNEU_PESQUISA_URL = base_origin() + "/sgtweb/sgt/pneu/te_movimentacao.php"


# ---------------- Fluxo ----------------
def abrir_listagem_movimentacoes(driver: webdriver.Chrome, numero_fogo: str) -> str:
    """
    Pesquisa o pneu em te_movimentacao.php. Submete o form e o servidor
    redireciona para te_movimentacaopneu.php?stIdEmpresa=...&stIdPneu=<id>.
    Retorna a URL final (que ja eh a listagem de movimentacoes).
    """
    driver.get(PNEU_PESQUISA_URL)
    WebDriverWait(driver, 15).until(
        EC.presence_of_element_located((By.NAME, "edtPneu"))
    )
    driver.execute_script(
        "const f = document.formulario;"
        "f.edtEmpresa.value = arguments[0];"
        "if (f.cbxEmpresa) f.cbxEmpresa.value = arguments[0];"
        "f.edtPneu.value = arguments[1];"
        "f.action = 'un_movimentacao.php';"
        "f.submit();",
        EMPRESA, numero_fogo,
    )
    # Aguarda a URL final virar te_movimentacaopneu.php
    deadline = time.time() + 15
    while time.time() < deadline:
        if "te_movimentacaopneu.php" in driver.current_url:
            return driver.current_url
        time.sleep(0.3)
    raise RuntimeError(f"nao caiu na listagem para pneu {numero_fogo}: url={driver.current_url}")


def extrair_ids_e_incluir(driver: webdriver.Chrome) -> tuple[str, str]:
    """
    Da pagina te_movimentacaopneu.php, extrai do link 'Incluir' os parametros:
      Redireciona('incluir', stPneu, stEmpresa, stMovimentacao)
    Retorna (stIdPneu, stIdMovimentacao).
    """
    html = driver.page_source or ""
    m = re.search(
        r"Redireciona\(\s*'incluir'\s*,\s*'(\d+)'\s*,\s*'(\d+)'\s*,\s*'(\d+)'\s*\)",
        html,
    )
    if not m:
        raise RuntimeError("link Incluir nao encontrado na pagina")
    stIdPneu = m.group(1)
    # m.group(2) = empresa
    stIdMovimentacao = m.group(3)
    return stIdPneu, stIdMovimentacao


def _achar_url_incluir_no_html(html: str) -> str | None:
    """
    Tenta localizar o gatilho de incluir no HTML da listagem.
    """
    m = re.search(
        r"""href=["']([^"']*Redireciona\(\s*['"]incluir['"][^"']*)["']""",
        html,
        re.I,
    )
    if m:
        return m.group(1)

    m = re.search(
        r"""onclick=["'][^"']*Redireciona\(\s*['"]incluir['"][^"']*["']""",
        html,
        re.I,
    )
    if m:
        return "onclick:Redireciona"

    return None


def abrir_form_inclusao(driver: webdriver.Chrome, stIdPneu: str, stIdMovimentacao: str):
    """
    Reproduz o clique em 'Incluir' chamando Redireciona() da propria pagina.
    Equivalente a submeter o form via POST para fm_movimentacaopneu.php?operacao=incluir.
    Precisa estar na pagina te_movimentacaopneu.php antes.
    """
    if "te_movimentacaopneu.php" not in driver.current_url:
        raise RuntimeError(f"esperado estar em te_movimentacaopneu.php, url={driver.current_url}")
    html = driver.page_source or ""
    url_incluir = _achar_url_incluir_no_html(html)
    if url_incluir and url_incluir.startswith("http"):
        log("click", f"indo direto para incluir: {url_incluir}")
        driver.get(url_incluir)
    else:
        candidatos = [
            (By.XPATH, "//a[contains(., 'Incluir') or contains(@href, 'incluir') or contains(@onclick, 'incluir')]"),
            (By.XPATH, "//input[contains(@value, 'Incluir') or contains(@onclick, 'incluir')]"),
            (By.XPATH, "//*[contains(@onclick, 'Redireciona') and contains(., 'Incluir')]"),
        ]
        ultimo_erro = None
        for by, sel in candidatos:
            try:
                link = WebDriverWait(driver, 5).until(EC.element_to_be_clickable((by, sel)))
                log("click", f"Incluir localizado por {by}={sel}")
                try:
                    link.click()
                except Exception:
                    driver.execute_script("arguments[0].click();", link)
                break
            except Exception as e:
                ultimo_erro = e
        else:
            raise RuntimeError(
                f"nao consegui localizar o gatilho de Incluir na pagina (url={driver.current_url})"
            ) from ultimo_erro

    if "fm_movimentacaopneu.php" not in driver.current_url:
        fallback_url = (
            base_origin()
            + "/sgtweb/sgt/pneu/fm_movimentacaopneu.php?operacao=incluir"
            + f"&stIdMovimentacao={stIdMovimentacao}"
            + f"&stIdEmpresa={EMPRESA}"
            + f"&stIdPneu={stIdPneu}"
        )
        log("click", f"fallback direto para form: {fallback_url}")
        driver.get(fallback_url)

    WebDriverWait(driver, 20).until(
        EC.presence_of_element_located((By.NAME, "edtMotivoMov"))
    )
    log("form", f"abriu fm_movimentacaopneu, url={driver.current_url}")


def preencher_e_submeter(driver: webdriver.Chrome, stIdPneu: str, stIdMovimentacao: str):
    """
    Preenche os campos via JS e dispara o submit POST para un_movimentacaopneu.php.
    Pula o window.confirm sobrescrevendo-o antes do submit.
    """
    from datetime import datetime

    data_mov = DATA_MOV or datetime.now().strftime("%d/%m/%Y")
    hora_mov = HORA_MOV or datetime.now().strftime("%H:%M:%S")
    js = """
    const f = document.formulario;
    const [stIdPneu, stIdMov, empresa, obs, motivoSucat, centro, dataMov, horaMov] = arguments;
    const obsText = String(obs ?? '').trim();

    function setField(name, value, preferTextArea = false) {
        const el =
            (preferTextArea && document.querySelector(`textarea[name="${name}"]`)) ||
            document.querySelector(`input[name="${name}"]:not([type="hidden"])`) ||
            document.querySelector(`[name="${name}"]`) ||
            f[name];
        if (!el) return false;
        el.value = value;
        el.dispatchEvent(new Event('input', { bubbles: true }));
        el.dispatchEvent(new Event('change', { bubbles: true }));
        return true;
    }

    // KM 0/0
    setField('edtKmInicial', '0');
    setField('edtKmFinal', '0');

    // motivo movimentacao = 005 SUCATEAR PNEU
    setField('edtMotivoMov', '005');
    setField('cbxMotivoMov', '005');

    // observacao obrigatoria
    setField('memObservacao', obsText, true);

    // centro de custo = 999 SUCATA
    setField('edtCentroCusto', centro);
    setField('cbxCentroCusto', centro);

    // motivo sucateamento
    setField('edtMotivoSucat', motivoSucat);
    setField('cbxMotivoSucat', motivoSucat);

    // data/hora da movimentacao
    setField('edtDataMov', dataMov);
    setField('edtHoraMov', horaMov);

    // hidden idEquipamento vazio (sucata nao precisa)
    setField('idEquipamento', '');

    if (!obsText) {
        throw new Error('observacao vazia');
    }

    // Submit direto pulando window.confirm de Redireciona()
    f.method = 'post';
    f.action = 'un_movimentacaopneu.php?op=incluir&stIdMovimentacao=' + stIdMov
             + '&stIdEmpresa=' + empresa
             + '&stIdPneu=' + stIdPneu
             + '&idPosicao=';
    f.submit();
    """
    driver.execute_script(
        js,
        stIdPneu, stIdMovimentacao, EMPRESA, OBSERVACAO, MOTIVO_SUCAT, CENTRO_CUSTO, data_mov, hora_mov,
    )
    # Espera resposta. Sucesso = volta pra te_movimentacaopneu.php (lista atualizada).
    # Erro = fica em fm_ ou un_ com mensagem de erro.
    deadline = time.time() + 15
    while time.time() < deadline:
        url = driver.current_url
        if "te_movimentacaopneu.php" in url:
            return  # ok
        if "fm_movimentacaopneu.php" in url or "un_movimentacaopneu.php" in url:
            # Pode ter recarregado com erro: verifica mensagem
            html = driver.page_source or ""
            m = re.search(r"class=\"css_erro\">\s*Mensagem:\s*\[([^\]]+)\]", html)
            if m:
                raise RuntimeError(f"erro TransNet: {m.group(1)[:200]}")
        time.sleep(0.4)
    raise RuntimeError(f"timeout aguardando confirmacao do submit, url={driver.current_url}")


def sucatear_um(driver: webdriver.Chrome, numero_fogo: str) -> dict:
    try:
        abrir_listagem_movimentacoes(driver, numero_fogo)
        stIdPneu, stIdMov = extrair_ids_e_incluir(driver)
        log("achou", f"{numero_fogo} -> stIdPneu={stIdPneu} stIdMov={stIdMov}")
        if DRY_RUN:
            return {"ok": True, "pneu": numero_fogo, "dry_run": True,
                    "stIdPneu": stIdPneu, "stIdMov": stIdMov}
        abrir_form_inclusao(driver, stIdPneu, stIdMov)
        preencher_e_submeter(driver, stIdPneu, stIdMov)
        return {"ok": True, "pneu": numero_fogo, "stIdPneu": stIdPneu}
    except Exception as e:
        msg = str(e)
        if "O PNEU JÁ SE ENCONTRA NESTE CENTRO DE CUSTO" in msg or "NAO ESTA VIGENTE NESTA DATA" in msg:
            return {
                "ok": True,
                "pneu": numero_fogo,
                "skipped": True,
                "erro": msg,
            }
        return {"ok": False, "pneu": numero_fogo, "erro": msg}


def main():
    if not (TRANSNET_USER and TRANSNET_PASSWORD):
        sys.exit("ENV faltando: TRANSNET_USER / TRANSNET_PASSWORD (bot/.env)")

    pneus = carregar_pneus()
    log("inicio", f"{len(pneus)} pneus | DRY_RUN={DRY_RUN} | HEADLESS={HEADLESS}")

    driver = make_driver()
    sucessos: list[str] = []
    pulados: list[tuple[str, str]] = []
    falhas: list[tuple[str, str]] = []
    try:
        login(driver)
        for i, p in enumerate(pneus, 1):
            log("pneu", f"[{i}/{len(pneus)}] {p}")
            r = sucatear_um(driver, p)
            if r.get("ok"):
                sucessos.append(p)
                if r.get("skipped"):
                    pulados.append((p, r.get("erro", "")))
                    log("skip", f"{p}: {r.get('erro')}")
            else:
                falhas.append((p, r.get("erro", "?")))
                log("ERRO", f"{p}: {r.get('erro')}")
            time.sleep(0.8)
    finally:
        log("fim", f"ok={len(sucessos)} pulados={len(pulados)} falhas={len(falhas)}")
        for p, e in pulados:
            log("pulado", f"{p}: {e}")
        for p, e in falhas:
            log("falha", f"{p}: {e}")
        try:
            if HEADLESS:
                driver.quit()
            else:
                input("\n[ENTER] para fechar o navegador...")
                driver.quit()
        except Exception:
            pass


if __name__ == "__main__":
    main()


