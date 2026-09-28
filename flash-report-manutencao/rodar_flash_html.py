# rodar_flash_html.py
# ------------------------------------------------------------------------------
# Rotina local do Flash Report Manutenção INTERATIVO (HTML):
#   1) pega as chaves service_role dos dois projetos via Supabase CLI (nada salvo em disco);
#   2) gera o HTML ao vivo (gen_flash_html.py);
#   3) arquiva em Reports\Report de Manutenção com a data;
#   4) grava/mostra o resumo (mesma conta da tela, p/ o resuminho do WhatsApp).
# Uso:  python rodar_flash_html.py [--saida PASTA]
# ------------------------------------------------------------------------------
import argparse
import json
import os
import shutil
import subprocess
import sys
from collections import Counter
from datetime import date
from pathlib import Path

AQUI = Path(__file__).resolve().parent
PASTA_REPORTS = Path(r"C:\Users\Guilh\OneDrive\Desktop\Reports\Report de Manutenção")
PROJ_A = "ubppprgquekozluvsloo"  # IMPORTAÇÃO_DADOS (indicadores_diesel, ultimo_plano, SR, regeneração)
PROJ_B = "wboelthngddvkgrvwkbu"  # INOVEQUATAI (sos_acionamentos, PCM, pneus, embarcados)
MESES = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto",
         "Setembro", "Outubro", "Novembro", "Dezembro"]


def _service_key(ref: str) -> str:
    out = subprocess.run(["supabase", "projects", "api-keys", "--project-ref", ref, "-o", "json"],
                         capture_output=True, text=True, check=True, shell=(os.name == "nt")).stdout
    return next(k["api_key"] for k in json.loads(out) if k["name"] == "service_role")


def _dias_no_mes(m: str) -> int:
    y, mm = int(m[:4]), int(m[5:7])
    return (date(y + (mm == 12), mm % 12 + 1, 1) - date(y, mm, 1)).days


def _add_m(m: str, k: int) -> str:
    y, mm = int(m[:4]), int(m[5:7]) - 1 + k
    y += mm // 12
    return f"{y}-{mm % 12 + 1:02d}"


def resumo(d: dict) -> dict:
    """Mesmas regras da capa / seções 05 e 14 do HTML (mês mais recente com KM consolidado)."""
    km_dia = Counter()
    for dia, _cl, km, _lt in d["km_dia_cl"]:
        km_dia[dia] += km
    dias_km = sorted(x for x, v in km_dia.items() if v > 0)
    ref = dias_km[-1][:7]
    dias_ref = [x for x in dias_km if x.startswith(ref)]
    interv = d["interv"]
    val = [x for x in interv if x["ok"] and x["d"] in set(dias_ref)]
    km = sum(km_dia[x] for x in dias_ref)
    mkbf = km / len(val) if val else 0

    uteis = [g for g in d["gns"]["dias"] if g["d"].startswith(ref) and g["u"]]
    regs = d["gns"]["regs"]
    gns = sum(sum(1 for i in g["c"] if regs[i][1] == "GNS") for g in uteis) / len(uteis) if uteis else 0

    planos = d["planos"]
    ader = (1 - sum(1 for p in planos if p[2]) / len(planos)) * 100 if planos else 0

    # defeito nº 1 do mês + tendência (ritmo 30d vs média dos 5 meses anteriores)
    sem = [_add_m(ref, -k) for k in range(5, -1, -1)]
    base = [x for x in interv if x["ok"] and x["p"] != "N/D" and x["d"][:7] in sem]
    top = Counter(x["p"] for x in base if x["d"].startswith(ref)).most_common(1)
    tend = None
    if top:
        nome, n = top[0]
        por_mes = Counter(x["d"][:7] for x in base if x["p"] == nome)
        dias_corr = int(d["fim"][8:10]) if d["fim"].startswith(ref) else _dias_no_mes(ref)
        media = sum(por_mes[m] / _dias_no_mes(m) for m in sem[:-1]) / 5 * 30
        proj = n / dias_corr * 30
        delta = proj - media
        tend = {"defeito": nome, "qtd": n, "ritmo_30d": round(proj, 1), "media_30d": round(media, 1),
                "tendencia": "subindo" if delta > 0.5 else "cedendo" if delta < -0.5 else "estável"}

    todas = [x for x in interv if x["d"].startswith(ref)]
    emb = [x for x in todas if x["em"]]
    fam = Counter(x["em"] for x in emb).most_common(1)
    return {
        "mes": f"{MESES[int(ref[5:7]) - 1]}/{ref[:4]}",
        "periodo": [dias_ref[0], dias_ref[-1]],
        "mkbf": round(mkbf), "intervencoes": len(val), "km": round(km),
        "gns_medio": round(gns, 1), "aderencia_preventiva": round(ader, 1),
        "defeito_mes": tend,
        "embarcados": {"total": len(emb), "pct": round(len(emb) / len(todas) * 100, 1) if todas else 0,
                       "familia_lider": fam[0] if fam else None},
        "gerado_em": d["gerado_em"], "secoes": 15,
    }


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--saida", default=str(PASTA_REPORTS))
    args = ap.parse_args()

    os.environ["SUPABASE_A_URL"] = f"https://{PROJ_A}.supabase.co"
    os.environ["SUPABASE_B_URL"] = f"https://{PROJ_B}.supabase.co"
    os.environ["SUPABASE_A_SERVICE_ROLE_KEY"] = _service_key(PROJ_A)
    os.environ["SUPABASE_B_SERVICE_ROLE_KEY"] = _service_key(PROJ_B)

    tmp = AQUI / "saida" / "Flash Report - Manutencao.html"
    tmp.parent.mkdir(exist_ok=True)
    os.environ["FLASH_HTML_SAIDA"] = str(tmp)
    sys.path.insert(0, str(AQUI))
    import gen_flash_html
    gen_flash_html.SAIDA = tmp
    dados = gen_flash_html.main()

    pasta = Path(args.saida)
    pasta.mkdir(parents=True, exist_ok=True)
    final = pasta / f"Flash Report Manutencao - Interativo {date.today():%Y-%m-%d}.html"
    shutil.copyfile(tmp, final)

    r = resumo(dados)
    r["arquivo"] = str(final)
    (AQUI / "saida" / "resumo_flash_html.json").write_text(json.dumps(r, ensure_ascii=False, indent=1), encoding="utf-8")
    print("RESUMO_JSON=" + json.dumps(r, ensure_ascii=False))


if __name__ == "__main__":
    main()
