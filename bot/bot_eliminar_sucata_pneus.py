# bot/bot_eliminar_sucata_pneus.py
# Bot LOCAL para eliminar lancamentos de sucata de pneus no TransNet.
# Para cada numero de fogo da lista:
#   1) pesquisa o pneu em te_movimentacao.php -> obtem stIdPneu
#   2) abre a listagem de movimentacoes
#   3) localiza o lancamento com SUCATA
#   4) entra no detalhe e clica em "Eliminar"
#
# Uso (Windows PowerShell, dentro de bot/):
#   .venv\Scripts\Activate.ps1
#   python bot_eliminar_sucata_pneus.py
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
DRY_RUN = _env("DRY_RUN", "false").lower() in ("1", "true", "yes")


# ---------------- Lista de pneus ----------------
# Numeros de fogo (6 digitos). Editar aqui ou criar bot/eliminar_sucata_pneus.txt
# (um por linha) que substitui esta lista.
PNEUS_DEFAULT = [
    "209386", "402038", "208925", "209037", "209048", "209290", "209332", "209334",
    "209346", "209358", "401001", "401005", "405003", "407013", "408004", "503006",
    "505009", "507010", "509070", "509111", "509115", "510017", "510023", "510029",
    "601007", "602003",
]


def carregar_pneus() -> list[str]:
    arq = Path(__file__).resolve().parent / "eliminar_sucata_pneus.txt"
    if arq.exists():
        linhas = [l.strip() for l in arq.read_text(encoding="utf-8").splitlines()]
        return [l.zfill(6) for l in linhas if l and not l.startswith("#")]
    return [p.zfill(6) for p in PNEUS_DEFAULT]


# ---------------- Selenium ----------------
def log(step: str, msg: str = ""):
    print(f"[elim-sucata] {step:>10}  {msg}", flush=True)


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
    driver.get(PNEU_PESQUISA_URL)
    WebDriverWait(driver, 15).until(EC.presence_of_element_located((By.NAME, "edtPneu")))
    driver.execute_script(
        "const f = document.formulario;"
        "f.edtEmpresa.value = arguments[0];"
        "if (f.cbxEmpresa) f.cbxEmpresa.value = arguments[0];"
        "f.edtPneu.value = arguments[1];"
        "f.action = 'un_movimentacao.php';"
        "f.submit();",
        EMPRESA, numero_fogo,
    )
    deadline = time.time() + 15
    while time.time() < deadline:
        if "te_movimentacaopneu.php" in driver.current_url:
            return driver.current_url
        time.sleep(0.3)
    raise RuntimeError(f"nao caiu na listagem para pneu {numero_fogo}: url={driver.current_url}")


def extrair_ids_pneu(driver: webdriver.Chrome) -> tuple[str, str]:
    html = driver.page_source or ""
    m = re.search(
        r"Redireciona\(\s*'incluir'\s*,\s*'(\d+)'\s*,\s*'(\d+)'\s*,\s*'(\d+)'\s*\)",
        html,
    )
    if not m:
        raise RuntimeError("link Incluir nao encontrado na pagina")
    return m.group(1), m.group(3)


def localizar_row_sucata(driver: webdriver.Chrome) -> dict:
    js = """
    const norm = (s) => String(s || '').replace(/\\s+/g, ' ').trim();
    const rows = Array.from(document.querySelectorAll('tr'));
    for (let i = rows.length - 1; i >= 0; i--) {
      const row = rows[i];
      const text = norm(row.innerText || row.textContent || '');
      if (!/\\bSUCAT/i.test(text)) continue;
      const anchors = Array.from(row.querySelectorAll('a')).map((a) => ({
        text: norm(a.textContent),
        href: a.getAttribute('href') || '',
        onclick: a.getAttribute('onclick') || '',
      }));
      return {
        text,
        anchors,
        rowHtml: row.innerHTML || ''
      };
    }
    return null;
    """
    row = driver.execute_script(js)
    if not row:
        raise RuntimeError("nao encontrei lancamento de sucata na listagem")
    return row


def abrir_detalhe_sucata(driver: webdriver.Chrome, numero_fogo: str):
    row = localizar_row_sucata(driver)
    anchors = row.get("anchors") or []
    log("linha", f"{numero_fogo}: {row.get('text', '')[:120]}")

    if anchors:
        escolhido = None
        for a in anchors:
            href = a.get("href") or ""
            onclick = a.get("onclick") or ""
            if "Redireciona" in href or "Redireciona" in onclick:
                escolhido = a
                break
        if escolhido is None:
            escolhido = anchors[-1]

        href = escolhido.get("href") or ""
        onclick = escolhido.get("onclick") or ""
        log("click", f"link escolhido href={href[:120]} onclick={onclick[:120]}")
        if href.startswith("javascript:"):
            expr = href[len("javascript:"):]
            driver.execute_script(expr)
        elif onclick:
            driver.execute_script(onclick)
        else:
            row_el = driver.find_element(By.XPATH, "(//tr[contains(., 'SUCAT')])[last()]")
            links = row_el.find_elements(By.XPATH, ".//a")
            if not links:
                raise RuntimeError("linha de sucata encontrada, mas sem links clicaveis")
            link = links[-1]
            try:
                link.click()
            except Exception:
                driver.execute_script("arguments[0].click();", link)
    else:
        # Fallback: se a linha nao tiver link, tenta clicar na primeira celula.
        cell = driver.find_element(By.XPATH, "(//tr[contains(., 'SUCAT')]//td)[1]")
        try:
            cell.click()
        except Exception:
            driver.execute_script("arguments[0].click();", cell)

    deadline = time.time() + 15
    while time.time() < deadline:
        html = driver.page_source or ""
        if "name=\"Eliminar\"" in html or "Eliminar" in html:
            return
        time.sleep(0.3)
    raise RuntimeError(f"nao abriu a tela de detalhe para eliminar, url={driver.current_url}")


def acionar_eliminar(driver: webdriver.Chrome):
    html = driver.page_source or ""
    if "name=\"Eliminar\"" in html:
        link = WebDriverWait(driver, 10).until(
            EC.element_to_be_clickable((By.XPATH, "//a[@name='Eliminar' or contains(., 'Eliminar')]"))
        )
    else:
        link = WebDriverWait(driver, 10).until(
            EC.element_to_be_clickable((By.XPATH, "//a[contains(., 'Eliminar') or contains(@href, 'eliminar')]"))
        )
    href = link.get_attribute("href") or ""
    onclick = link.get_attribute("onclick") or ""
    log("click", f"Eliminar href={href}")
    try:
        driver.execute_script("window.confirm = () => true;")
    except Exception:
        pass

    if href.startswith("javascript:"):
        driver.execute_script(href[len("javascript:"):])
    elif onclick:
        driver.execute_script(onclick)
    else:
        try:
            link.click()
        except Exception:
            driver.execute_script("arguments[0].click();", link)

    # Algumas telas disparam confirmacao do browser.
    try:
        WebDriverWait(driver, 2).until(EC.alert_is_present())
        driver.switch_to.alert.accept()
    except Exception:
        pass

    deadline = time.time() + 20
    while time.time() < deadline:
        url = driver.current_url
        html = driver.page_source or ""
        if "te_movimentacaopneu.php" in url:
            return
        if "css_erro" in html:
            m = re.search(r"class=\"css_erro\">\s*Mensagem:\s*\[([^\]]+)\]", html)
            if m:
                raise RuntimeError(f"erro TransNet: {m.group(1)[:200]}")
        time.sleep(0.4)
    raise RuntimeError(f"timeout aguardando retorno apos eliminar, url={driver.current_url}")


def eliminar_um(driver: webdriver.Chrome, numero_fogo: str) -> dict:
    try:
        abrir_listagem_movimentacoes(driver, numero_fogo)
        stIdPneu, stIdMov = extrair_ids_pneu(driver)
        log("achou", f"{numero_fogo} -> stIdPneu={stIdPneu} stIdMov={stIdMov}")
        if DRY_RUN:
            return {"ok": True, "pneu": numero_fogo, "dry_run": True, "stIdPneu": stIdPneu, "stIdMov": stIdMov}
        abrir_detalhe_sucata(driver, numero_fogo)
        acionar_eliminar(driver)
        return {"ok": True, "pneu": numero_fogo, "stIdPneu": stIdPneu, "stIdMov": stIdMov}
    except Exception as e:
        return {"ok": False, "pneu": numero_fogo, "erro": str(e)}


def main():
    if not (TRANSNET_USER and TRANSNET_PASSWORD):
        sys.exit("ENV faltando: TRANSNET_USER / TRANSNET_PASSWORD (bot/.env)")

    pneus = carregar_pneus()
    log("inicio", f"{len(pneus)} pneus | DRY_RUN={DRY_RUN} | HEADLESS={HEADLESS}")

    driver = make_driver()
    sucessos: list[str] = []
    falhas: list[tuple[str, str]] = []
    try:
        login(driver)
        for i, p in enumerate(pneus, 1):
            log("pneu", f"[{i}/{len(pneus)}] {p}")
            r = eliminar_um(driver, p)
            if r.get("ok"):
                sucessos.append(p)
            else:
                falhas.append((p, r.get("erro", "?")))
                log("ERRO", f"{p}: {r.get('erro')}")
            time.sleep(0.8)
    finally:
        log("fim", f"ok={len(sucessos)} falhas={len(falhas)}")
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
