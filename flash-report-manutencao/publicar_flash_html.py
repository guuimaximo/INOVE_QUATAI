# publicar_flash_html.py
# ------------------------------------------------------------------------------
# Publica o Flash Report Manutenção INTERATIVO no storage do INOVE (bucket
# "relatorios"), de onde a página /sos-flash (e /pcm-flash) do INOVE lê.
#
#   relatorios/manutencao/flash_interativo/atual.html            <- sempre o último
#   relatorios/manutencao/flash_interativo/meta.json             <- gerado_em + resumo
#   relatorios/manutencao/flash_interativo/historico/AAAA-MM-DD.html
#
# Roda no GitHub Actions (bot-flash-manutencao-interativo.yml) com as mesmas
# variáveis do gen_flash_manutencao.py (SUPABASE_A_* = TransNet, SUPABASE_B_* = INOVE).
# ------------------------------------------------------------------------------
import json
import os
import sys
from datetime import datetime
from pathlib import Path
from zoneinfo import ZoneInfo

AQUI = Path(__file__).resolve().parent
sys.path.insert(0, str(AQUI))

BUCKET = os.getenv("REPORT_BUCKET", "relatorios")
PREFIXO = os.getenv("FLASH_HTML_PREFIXO", "manutencao/flash_interativo")


def main():
    saida = AQUI / "saida" / "Flash_Manutencao_Interativo.html"
    saida.parent.mkdir(exist_ok=True)
    os.environ["FLASH_HTML_SAIDA"] = str(saida)

    import gen_flash_html
    from rodar_flash_html import resumo

    gen_flash_html.SAIDA = saida
    dados = gen_flash_html.main()
    agora = datetime.now(ZoneInfo("America/Sao_Paulo"))

    meta = {
        "gerado_em": dados["gerado_em"],
        "gerado_em_iso": agora.isoformat(timespec="seconds"),
        "janela": [dados["ini"], dados["fim"]],
        "arquivo": f"{PREFIXO}/atual.html",
        "tamanho_kb": round(saida.stat().st_size / 1024),
        "resumo": resumo(dados),
    }

    sb = gen_flash_html.g._sb_b()
    st = sb.storage.from_(BUCKET)
    html = saida.read_bytes()
    opts = {"content-type": "text/html; charset=utf-8", "cache-control": "300", "upsert": "true"}
    st.upload(path=f"{PREFIXO}/atual.html", file=html, file_options=opts)
    st.upload(path=f"{PREFIXO}/historico/{agora:%Y-%m-%d}.html", file=html, file_options=opts)
    st.upload(path=f"{PREFIXO}/meta.json", file=json.dumps(meta, ensure_ascii=False).encode("utf-8"),
              file_options={"content-type": "application/json; charset=utf-8", "cache-control": "60", "upsert": "true"})
    print(f"☁️ Publicado em {BUCKET}/{PREFIXO}/atual.html ({meta['tamanho_kb']} KB) — {meta['gerado_em']}")
    print("RESUMO_JSON=" + json.dumps(meta["resumo"], ensure_ascii=False))


if __name__ == "__main__":
    main()
