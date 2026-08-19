"""Exporta a lista DETALHADA de acompanhamentos: uma linha por sessao.

Colunas pedidas: data, motorista, linha, tabela, hora de inicio e hora de fim.

diesel_acompanhamento_sessoes tem data, horarios e o id do acompanhamento;
diesel_acompanhamentos tem o motorista. Linha e tabela NAO existem nessas tabelas -
saem da operacao daquele motorista naquele dia (premiacao_diaria_atualizada), pela
linha/tabela em que ele rodou mais km no dia.

Roda sozinho, fora do gerador do relatorio, e escreve um CSV. Nao depende do
gen_flash_diesel_v3 de proposito: aquele modulo gera 20 graficos so de ser importado.
"""
import csv
import datetime as dt
import json
import os
import sys
import urllib.parse
import urllib.request
from collections import defaultdict
from pathlib import Path

OUT = Path(__file__).resolve().parent
MESES = int(os.environ.get("EXPORT_MESES", "3"))


def creds(url_var, key_var):
    u = os.environ.get(url_var, "").strip().rstrip("/")
    k = os.environ.get(key_var, "").strip()
    if not (u and k):
        sys.exit(f"[erro] faltam {url_var} / {key_var} no ambiente.")
    return u, k


def get(url, key, path, params):
    q = urllib.parse.urlencode(params, safe="().,:-*")
    req = urllib.request.Request(f"{url}/rest/v1/{path}?{q}",
                                 headers={"apikey": key, "Authorization": f"Bearer {key}"})
    with urllib.request.urlopen(req, timeout=90) as r:
        return json.loads(r.read().decode("utf-8"))


def pagina(url, key, path, params):
    linhas, off = [], 0
    while True:
        b = get(url, key, path, params + [("limit", "1000"), ("offset", str(off))])
        linhas += b
        if len(b) < 1000:
            break
        off += 1000
    return linhas


def norm_chapa(c):
    x = str(c or "").strip()
    if x.endswith(".0"):
        x = x[:-2]
    return x.lstrip("0")


def hora(iso):
    """'2026-08-14T19:32:10+00:00' -> '19:32'. Retorna '' se nao vier nada."""
    s = str(iso or "")
    if "T" not in s:
        return ""
    hm = s.split("T", 1)[1][:5]
    return hm if len(hm) == 5 else ""


hoje = dt.date.today()
ini = (hoje.replace(day=1) - dt.timedelta(days=31 * (MESES - 1))).replace(day=1)
print(f"[export] janela: {ini} ate {hoje} ({MESES} meses)")

inv_url, inv_key = creds("SUPABASE_URL", "SUPABASE_SERVICE_KEY")
bc_url, bc_key = creds("SUPABASE_BCNT_URL", "SUPABASE_BCNT_KEY")

# ---- sonda as colunas: 'tabela' nunca foi confirmada em nenhuma das bases ----
def colunas(url, key, tabela):
    try:
        am = get(url, key, tabela, [("select", "*"), ("limit", "1")])
        return sorted(am[0].keys()) if am else []
    except Exception as e:
        print(f"[sonda] {tabela} falhou: {e}")
        return []


cols_pd = colunas(bc_url, bc_key, "premiacao_diaria_atualizada")
cols_ss = colunas(inv_url, inv_key, "diesel_acompanhamento_sessoes")
cols_ac = colunas(inv_url, inv_key, "diesel_acompanhamentos")
print(f"[sonda] premiacao_diaria_atualizada: {cols_pd}")
print(f"[sonda] diesel_acompanhamento_sessoes: {cols_ss}")
print(f"[sonda] diesel_acompanhamentos: {cols_ac}")

CAND_TABELA = ["tabela", "tabela_operacional", "nr_tabela", "cod_tabela", "servico",
               "nr_servico", "escala", "linha_tabela"]
col_tabela = next((c for c in CAND_TABELA if c in cols_pd), None)
print(f"[sonda] coluna de tabela na premiacao: {col_tabela or 'NAO EXISTE'}")

# A tabela operacional pode estar dentro de um JSON (metadata / foco_snapshot). Varre as
# chaves de verdade, inclusive aninhadas, em vez de supor que nao existe.
def chaves_json(url, key, tab, campos, n=400):
    achou = set()
    try:
        am = get(url, key, tab, [("select", ",".join(campos)), ("limit", str(n))])
    except Exception as e:
        print(f"[sonda] json de {tab} falhou: {e}")
        return achou

    def anda(v, pre=""):
        if isinstance(v, dict):
            for k, vv in v.items():
                achou.add(f"{pre}{k}")
                anda(vv, f"{pre}{k}.")
        elif isinstance(v, list):
            for vv in v[:3]:
                anda(vv, pre)
    for r in am:
        for c in campos:
            anda(r.get(c), f"{c}.")
    return achou


ch_ss = chaves_json(inv_url, inv_key, "diesel_acompanhamento_sessoes",
                    ["metadata", "foco_snapshot"])
ch_ac = chaves_json(inv_url, inv_key, "diesel_acompanhamentos", ["metadata", "checklist"])
print(f"[sonda] chaves em sessoes.metadata/foco: {sorted(ch_ss)[:60]}")
print(f"[sonda] chaves em acompanhamentos.metadata/checklist: {sorted(ch_ac)[:60]}")
alvo = [c for c in sorted(ch_ss | ch_ac)
        if any(t in c.lower() for t in ("tabela", "servic", "escala", "carro", "veic", "linha"))]
print(f"[sonda] chaves que parecem tabela/linha/veiculo: {alvo}")

# ---- sessoes + motorista ----
sess = pagina(inv_url, inv_key,
              "diesel_acompanhamento_sessoes",
              [("select", "data_sessao,instrutor_nome,iniciado_em,encerrado_em,hora_inicio,"
                          "hora_fim,linha_snapshot,status_sessao,sessao_numero,"
                          "acompanhamento_id,foco_snapshot"),
               ("data_sessao", f"gte.{ini.isoformat()}")])
print(f"[export] {len(sess)} sessoes desde {ini}")

acomp = pagina(inv_url, inv_key, "diesel_acompanhamentos",
               [("select", "id,motorista_nome,motorista_chapa")])
mot_de = {a["id"]: (a.get("motorista_nome") or "", str(a.get("motorista_chapa") or ""))
          for a in acomp}

# ---- operacao do dia: linha e tabela em que o motorista mais rodou ----
sel = ["dia", "motorista", "linha", "prefixo", "km_rodado"]
if col_tabela:
    sel.append(col_tabela)
op = pagina(bc_url, bc_key, "premiacao_diaria_atualizada",
            [("select", ",".join(sel)), ("dia", f"gte.{ini.isoformat()}")])
print(f"[export] {len(op)} registros de operacao")

por_dia = defaultdict(lambda: {"linha": defaultdict(float), "tabela": defaultdict(float),
                               "carro": defaultdict(float)})
for r in op:
    d = str(r.get("dia") or "")[:10]
    km = r.get("km_rodado") or 0
    try:
        km = float(km)
    except (TypeError, ValueError):
        km = 0.0
    if len(d) < 10 or km <= 0:
        continue
    k = (norm_chapa(r.get("motorista")), d)
    ln = str(r.get("linha") or "").strip()
    if ln:
        por_dia[k]["linha"][ln] += km
    if col_tabela:
        tb = str(r.get(col_tabela) or "").strip()
        if tb:
            por_dia[k]["tabela"][tb] += km
    pf = str(r.get("prefixo") or "").strip()
    if pf:
        por_dia[k]["carro"][pf] += km


def topo(d):
    return max(d.items(), key=lambda x: x[1])[0] if d else ""


linhas_csv, sem_op = [], 0
for s in sess:
    data = str(s.get("data_sessao") or "")[:10]
    nome, chapa = mot_de.get(s.get("acompanhamento_id"), ("", ""))
    dia = por_dia.get((norm_chapa(chapa), data))
    if not dia:
        sem_op += 1
    # hora_inicio/hora_fim sao campos proprios da sessao; iniciado_em/encerrado_em sao
    # timestamps UTC do registro. Prefere o campo proprio e cai no timestamp se faltar.
    ini_h = str(s.get("hora_inicio") or "")[:5] or hora(s.get("iniciado_em"))
    fim_h = str(s.get("hora_fim") or "")[:5] or hora(s.get("encerrado_em"))
    dur = ""
    if ini_h and fim_h:
        a = dt.datetime.strptime(ini_h, "%H:%M")
        b = dt.datetime.strptime(fim_h, "%H:%M")
        mins = int((b - a).total_seconds() // 60)
        if mins < 0:                      # virou a meia-noite (acompanhamento noturno)
            mins += 24 * 60
        dur = mins
    linhas_csv.append({
        "data": data,
        "motorista": nome.title(),
        "chapa": chapa,
        # linha_snapshot e a linha capturada na hora do acompanhamento - e a fonte certa.
        # A linha da operacao do dia fica como reserva, para as sessoes sem snapshot.
        "linha": (str(s.get("linha_snapshot") or "").strip()
                  or (topo(dia["linha"]) if dia else "")),
        "linha_origem": ("snapshot" if str(s.get("linha_snapshot") or "").strip()
                         else ("operacao do dia" if dia else "")),
        "tabela": (topo(dia["tabela"]) if dia else "") if col_tabela else "",
        "carro": topo(dia["carro"]) if dia else "",
        "hora_inicio": ini_h,
        "hora_fim": fim_h,
        "duracao_min": dur,
        "instrutor": (s.get("instrutor_nome") or "").title(),
        "sessao": s.get("sessao_numero") or "",
        "status": s.get("status_sessao") or "",
        "foco": s.get("foco_snapshot") or "",
    })

linhas_csv.sort(key=lambda r: (r["data"], r["hora_inicio"], r["motorista"]))
dest = OUT / "acompanhamentos_detalhe.csv"
with dest.open("w", encoding="utf-8-sig", newline="") as f:
    w = csv.DictWriter(f, fieldnames=list(linhas_csv[0].keys()) if linhas_csv else
                       ["data", "motorista", "chapa", "linha", "tabela", "carro",
                        "hora_inicio", "hora_fim", "duracao_min", "instrutor", "foco"])
    w.writeheader()
    w.writerows(linhas_csv)

com_hora = sum(1 for r in linhas_csv if r["hora_inicio"])
com_fim = sum(1 for r in linhas_csv if r["hora_fim"])
com_linha = sum(1 for r in linhas_csv if r["linha"])
por_snap = sum(1 for r in linhas_csv if r.get("linha_origem") == "snapshot")
com_tab = sum(1 for r in linhas_csv if r["tabela"])
print(f"[export] {len(linhas_csv)} sessoes escritas em {dest.name}")
print(f"[export] com hora inicio: {com_hora} | com hora fim: {com_fim} | "
      f"com linha: {com_linha} (snapshot: {por_snap}) | com tabela: {com_tab} | "
      f"sem operacao no dia: {sem_op}")
