"""Encerra ou apaga as tratativas com SLA vencido (diesel_tratativas, Supabase INOVE).

POR PADRAO NAO ESCREVE NADA: lista o que seria afetado e grava um backup JSON.
So altera o banco com --confirmar, e o modo padrao e ENCERRAR (muda status), nao apagar.

    python limpar_tratativas_atrasadas.py                      # simulacao + backup
    python limpar_tratativas_atrasadas.py --confirmar          # encerra as vencidas
    python limpar_tratativas_atrasadas.py --apagar --confirmar # apaga de vez (irreversivel)

Credenciais: SUPABASE_URL e SUPABASE_SERVICE_KEY no ambiente.
"""
import datetime as dt
import json
import os
import sys
import urllib.parse
import urllib.request
from pathlib import Path

# Mesmo SLA por prioridade usado pelo relatorio (gen_flash_diesel_v3.py).
SLA = {"Gravíssima": 1, "Gravissima": 1, "Alta": 3, "Média": 7, "Media": 7, "Baixa": 15}
STATUS_ENCERRADO = "Concluída"

URL = os.environ.get("SUPABASE_URL", "").strip().rstrip("/")
KEY = os.environ.get("SUPABASE_SERVICE_KEY", "").strip()
APAGAR = "--apagar" in sys.argv
CONFIRMAR = "--confirmar" in sys.argv


def _req(metodo, caminho, params=None, corpo=None):
    q = ("?" + urllib.parse.urlencode(params, safe="().,:-")) if params else ""
    req = urllib.request.Request(
        f"{URL}/rest/v1/{caminho}{q}",
        method=metodo,
        data=json.dumps(corpo).encode() if corpo is not None else None,
        headers={"apikey": KEY, "Authorization": f"Bearer {KEY}",
                 "Content-Type": "application/json", "Prefer": "return=representation"})
    with urllib.request.urlopen(req, timeout=60) as r:
        txt = r.read().decode("utf-8")
        return json.loads(txt) if txt.strip() else []


def main():
    if not URL or not KEY:
        sys.exit("Faltam SUPABASE_URL / SUPABASE_SERVICE_KEY no ambiente.")

    hoje = dt.date.today()
    linhas, off = [], 0
    while True:
        b = _req("GET", "diesel_tratativas",
                 [("select", "id,motorista_nome,motorista_chapa,linha,prioridade,status,created_at"),
                  ("limit", "1000"), ("offset", str(off))])
        linhas += b
        if len(b) < 1000:
            break
        off += 1000

    vencidas = []
    for t in linhas:
        if (t.get("status") or "").startswith("Conclu"):
            continue
        try:
            dias = (hoje - dt.date.fromisoformat(str(t.get("created_at") or "")[:10])).days
        except ValueError:
            continue
        if dias > SLA.get((t.get("prioridade") or "").strip(), 7):
            t["_dias_aberto"] = dias
            vencidas.append(t)

    vencidas.sort(key=lambda t: -t["_dias_aberto"])
    print(f"{len(linhas)} tratativas na base · {len(vencidas)} com SLA vencido\n")
    for t in vencidas:
        print(f"  {t['_dias_aberto']:>4}d  {t.get('prioridade','-'):<10} "
              f"{str(t.get('linha') or '-'):<6} {t.get('motorista_nome','')[:38]}")

    if not vencidas:
        return

    backup = Path(__file__).parent / f"backup_tratativas_{hoje.isoformat()}.json"
    backup.write_text(json.dumps(vencidas, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"\nBackup gravado em {backup.name}")

    acao = "APAGAR" if APAGAR else f"marcar como '{STATUS_ENCERRADO}'"
    if not CONFIRMAR:
        print(f"\nSIMULACAO — nada foi alterado. Para {acao} estas {len(vencidas)}, "
              f"rode de novo com --confirmar.")
        return

    print(f"\n{acao} {len(vencidas)} tratativas...")
    for t in vencidas:
        alvo = [("id", f"eq.{t['id']}")]
        if APAGAR:
            _req("DELETE", "diesel_tratativas", alvo)
        else:
            _req("PATCH", "diesel_tratativas", alvo, {"status": STATUS_ENCERRADO})
    print(f"Pronto: {len(vencidas)} registros processados. Backup em {backup.name}")


if __name__ == "__main__":
    main()
