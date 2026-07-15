# -*- coding: utf-8 -*-
"""
Diesel - Relatorio Diario (Telegram).
Nucleo (Transnet indicadores_diesel): KM/L do dia vs meta, desperdicio, comparativo,
melhores/piores, evolucao diaria Transnet x Telemetria, "rodou sem abastecimento",
divergencia SST x Transnet. Extras (BCNT premiacao): evolucao mensal do ano + tabela,
KM/L por cluster e por linha. Roda no GitHub Actions 09h BRT. Credenciais via secrets.
"""
import os, json, urllib.request, urllib.parse, datetime, traceback
from collections import defaultdict
import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
from matplotlib.patches import FancyBboxPatch
import numpy as np
import requests

META = 2.80
# Sabado/domingo/feriado a frota roda com ~30 carros, entao o corte precisa ficar bem abaixo disso.
MIN_VEIC_CONSOLIDADO = 20
JANELA_DIAS = 45
EVOL_DIAS = 30
PREFIXO_IGNORAR = ("2216",)
MESNOME = {1: "Jan", 2: "Fev", 3: "Mar", 4: "Abr", 5: "Mai", 6: "Jun",
           7: "Jul", 8: "Ago", 9: "Set", 10: "Out", 11: "Nov", 12: "Dez"}

TU = os.environ["SUPABASE_TRANSNET_URL"].rstrip("/")
TK = os.environ["SUPABASE_TRANSNET_KEY"]
BU = os.environ.get("SUPABASE_BCNT_URL", "").rstrip("/")
BK = os.environ.get("SUPABASE_BCNT_KEY", "")
TG = os.environ["TELEGRAM_BOT_TOKEN"]
CHATS = [c.strip() for c in os.environ["TELEGRAM_CHAT_ID"].split(",") if c.strip()]
API = f"https://api.telegram.org/bot{TG}"

# WhatsApp Business Cloud API (opcional: so envia se as 3 primeiras estiverem definidas).
# Destinos em E.164 sem '+' (ex.: 5567999999999), separados por virgula.
WA_TOKEN = os.environ.get("WHATSAPP_TOKEN", "")
WA_PHONE_ID = os.environ.get("WHATSAPP_PHONE_NUMBER_ID", "")
WA_DESTINOS = [c.strip() for c in os.environ.get("WHATSAPP_DESTINOS", "").split(",") if c.strip()]
WA_TEMPLATE = os.environ.get("WHATSAPP_TEMPLATE", "diesel_diario")
WA_LANG = os.environ.get("WHATSAPP_TEMPLATE_LANG", "pt_BR")
WA_API = f"https://graph.facebook.com/v22.0/{WA_PHONE_ID}"

TEAL = "#0e7c7b"; PURP = "#7c3aed"; DARK = "#0f172a"; RED = "#c0392b"
GREEN = "#15803d"; GREY = "#64748b"; BG = "#f8fafc"; ED = "#dbe3ee"; AMBER = "#d97706"


def num(x):
    try:
        return float(x)
    except Exception:
        return None


def br(v, d=2):
    return f"{v:,.{d}f}".replace(",", "X").replace(".", ",").replace("X", ".")


def _get(base, key, path, params):
    rows, off = [], 0
    while True:
        q = urllib.parse.urlencode(params + [("limit", "1000"), ("offset", str(off))], safe="().,:-")
        req = urllib.request.Request(f"{base}/rest/v1/{path}?{q}",
                                     headers={"apikey": key, "Authorization": f"Bearer {key}"})
        with urllib.request.urlopen(req, timeout=120) as r:
            b = json.loads(r.read().decode())
        rows += b
        if len(b) < 1000:
            break
        off += 1000
    return rows


def sb_get(path, params):
    return _get(TU, TK, path, params)


def bcnt_get(path, params):
    return _get(BU, BK, path, params)


def data_br(iso):
    return iso[8:10] + "/" + iso[5:7] + "/" + iso[:4]


# ---------------- NUCLEO (Transnet) ----------------

def carregar():
    ini = (datetime.date.today() - datetime.timedelta(days=JANELA_DIAS)).isoformat()
    return sb_get("indicadores_diesel", [
        ("select", "data_consolidada,veiculo,placa,km_transnet,combustivel_transnet,km_sst,combustivel_sst"),
        ("data_consolidada", f"gte.{ini}"),
        ("order", "data_consolidada"),
    ])


def computar(dados):
    dia = defaultdict(lambda: {"km": 0., "lt": 0., "n": 0, "veic": [], "ks": 0., "cs": 0.})
    for r in dados:
        dd = r["data_consolidada"]
        kt, ct = num(r["km_transnet"]), num(r["combustivel_transnet"])
        ks, cs = num(r["km_sst"]), num(r["combustivel_sst"])
        d = dia[dd]
        if kt and ct and kt > 0 and ct > 0:
            d["km"] += kt; d["lt"] += ct; d["n"] += 1
            d["veic"].append((r["veiculo"], r.get("placa") or "", kt, ct))
        if ks and cs and cs > 0 and 1.0 <= ks / cs <= 4.5:
            d["ks"] += ks; d["cs"] += cs

    cons = sorted([x for x in dia if dia[x]["n"] >= MIN_VEIC_CONSOLIDADO])
    if len(cons) < 2:
        return None
    REF, PREV = cons[-1], cons[-2]
    kml = lambda x: dia[x]["km"] / dia[x]["lt"]

    dias_mes = [x for x in cons if x[:7] == REF[:7]]
    akm = sum(dia[x]["km"] for x in dias_mes); alt = sum(dia[x]["lt"] for x in dias_mes)
    kmR, ltR = dia[REF]["km"], dia[REF]["lt"]
    ideal = kmR / META; desp = ltR - ideal

    vs = [(v, p, k / l) for v, p, k, l in dia[REF]["veic"] if k >= 100 and 1.0 <= k / l <= 4.0]
    vs.sort(key=lambda x: x[2])
    piores = vs[:5]; melhores = vs[-5:][::-1]

    sem_abast = []
    for r in dados:
        if r["data_consolidada"] != REF:
            continue
        ks = num(r["km_sst"]); ct = num(r["combustivel_transnet"])
        if ks and ks > 15 and (ct is None or ct == 0):
            sem_abast.append((r["veiculo"], r.get("placa") or "", round(ks)))
    sem_abast.sort(key=lambda x: -x[2])

    ult10 = set(cons[-10:])
    ve = defaultdict(lambda: {"kt": 0., "ct": 0., "ks": 0., "cs": 0., "placa": ""})
    for r in dados:
        if r["data_consolidada"] not in ult10:
            continue
        v = str(r["veiculo"])
        if v.startswith(PREFIXO_IGNORAR):
            continue
        kt, ct = num(r["km_transnet"]), num(r["combustivel_transnet"])
        ks, cs = num(r["km_sst"]), num(r["combustivel_sst"])
        ve[v]["placa"] = r.get("placa") or ""
        if kt and ct:
            ve[v]["kt"] += kt; ve[v]["ct"] += ct
        if ks and cs:
            ve[v]["ks"] += ks; ve[v]["cs"] += cs
    diverg = []
    for v, a in ve.items():
        if a["ct"] <= 0 or a["cs"] <= 0 or a["kt"] <= 250:
            continue
        t = a["kt"] / a["ct"]; s = a["ks"] / a["cs"]
        if not (1.0 <= t <= 4.5):
            continue
        d = (s - t) / t * 100
        if abs(d) > 10:
            diverg.append((v, a["placa"], round(t, 2), round(s, 2), round(d, 1)))
    diverg.sort(key=lambda x: -abs(x[4]))

    serie = []
    for x in cons[-EVOL_DIAS:]:
        a = dia[x]
        if a["cs"] > 0:
            t = a["km"] / a["lt"]; s = a["ks"] / a["cs"]
            if abs((s - t) / t * 100) <= 15:
                serie.append((x, round(t, 3), round(s, 3)))

    return {"REF": REF, "PREV": PREV, "kref": round(kml(REF), 3), "kprev": round(kml(PREV), 3),
            "acum": round(akm / alt, 3), "km": round(kmR), "lt": round(ltR),
            "ideal": round(ideal), "desp": round(desp), "nveic": dia[REF]["n"],
            "piores": [(v, round(k, 2)) for v, p, k in piores],
            "melhores": [(v, round(k, 2)) for v, p, k in melhores],
            "sem_abast": sem_abast, "diverg": diverg, "serie": serie}


# ---------------- EXTRAS (BCNT: mensal, cluster, linha) ----------------

def carregar_extras():
    ano = datetime.date.today().year
    tr = sb_get("indicadores_diesel", [
        ("select", "data_consolidada,km_transnet,combustivel_transnet"),
        ("data_consolidada", f"gte.{ano}-01-01"), ("order", "data_consolidada")])
    prem = bcnt_get("premiacao_diaria_atualizada", [
        ("select", "mes,prefixo,linha,km_rodado,litros_consumidos,meta_kml_usada"), ("ano", f"eq.{ano}")])
    veic = bcnt_get("veiculos_ativos", [("select", "nr_ordem,per_cluster")])
    return tr, prem, veic


def computar_extras(tr, prem, veic):
    trm = defaultdict(lambda: [0., 0.])
    for r in tr:
        kt, ct = num(r["km_transnet"]), num(r["combustivel_transnet"])
        if kt and ct and kt > 0 and ct > 0:
            m = int(r["data_consolidada"][5:7]); trm[m][0] += kt; trm[m][1] += ct
    telm = defaultdict(lambda: [0., 0.])
    for r in prem:
        km, lt = num(r["km_rodado"]), num(r["litros_consumidos"])
        if km and lt and km >= 5 and lt > 0 and 1.5 <= km / lt <= 4.5:
            telm[int(r["mes"])][0] += km; telm[int(r["mes"])][1] += lt
    meses = sorted(set(trm) | set(telm))
    serie = []
    for m in meses:
        t = trm[m][0] / trm[m][1] if trm[m][1] else None
        te = telm[m][0] / telm[m][1] if telm[m][1] else None
        if t and te:
            serie.append((m, round(t, 3), round(te, 3)))

    cl = {str(v["nr_ordem"]): v.get("per_cluster") for v in veic if v.get("nr_ordem")}
    mes_atual = max(int(r["mes"]) for r in prem if r.get("mes"))
    clu = defaultdict(lambda: [0., 0., 0.]); lin = defaultdict(lambda: [0., 0., 0.])
    for r in prem:
        if int(r["mes"]) != mes_atual:
            continue
        km, lt = num(r["km_rodado"]), num(r["litros_consumidos"]); mt = num(r["meta_kml_usada"]) or META
        if not km or not lt or km < 5 or lt <= 0:
            continue
        c = cl.get(str(r.get("prefixo")))
        if c:
            clu[c][0] += km; clu[c][1] += lt; clu[c][2] += mt * km
        L = r.get("linha")
        if L:
            lin[L][0] += km; lin[L][1] += lt; lin[L][2] += mt * km
    clusters = sorted([(k, round(a[0] / a[1], 3), round(a[2] / a[0], 3), round(a[0]))
                       for k, a in clu.items() if a[0] > 2000], key=lambda x: -x[1])
    linhas = sorted([(k, round(a[0] / a[1], 3), round(a[2] / a[0], 3), round(a[0]))
                     for k, a in lin.items() if a[0] > 3000], key=lambda x: x[1])
    return {"serie_mes": serie, "clusters": clusters, "linhas": linhas, "mes_atual": mes_atual}


# ---------------- RENDER ----------------

def render_slide(o, path):
    kref = o["kref"]; delta = kref - META
    fig = plt.figure(figsize=(13.33, 7.5)); ax = fig.add_axes([0, 0, 1, 1])
    ax.axis("off"); ax.set_xlim(0, 100); ax.set_ylim(0, 100)
    ax.text(3, 95, "Diesel - Relatorio Diario", fontsize=27, fontweight="bold", color=DARK)
    ax.text(3, 90, f"Dia {data_br(o['REF'])}  -  ultimo dia consolidado (Transnet)  -  {o['nveic']} veiculos",
            fontsize=12.5, color=GREY)
    ax.add_patch(FancyBboxPatch((3, 55), 30, 30, boxstyle="round,pad=0.5", fc=DARK, ec=DARK, lw=0))
    ax.text(18, 80.5, "KM/L DO DIA", fontsize=12.5, color="#94a3b8", ha="center", fontweight="bold")
    ax.text(18, 70.5, br(kref), fontsize=38, fontweight="bold", color="white", ha="center")
    ax.text(18, 63, f"meta {br(META)}   -   {'+' if delta >= 0 else '-'}{br(abs(delta))}",
            fontsize=13, color=(GREEN if delta >= 0 else "#fca5a5"), ha="center", fontweight="bold")
    ax.text(18, 58, ("acima da meta" if delta >= 0 else "abaixo da meta"), fontsize=11, color="#cbd5e1", ha="center")
    ax.add_patch(FancyBboxPatch((35, 55), 30, 30, boxstyle="round,pad=0.5", fc="white", ec=RED, lw=2.2))
    ax.text(50, 80.5, "DESPERDICIO DO DIA", fontsize=12.5, color=RED, ha="center", fontweight="bold")
    ax.text(50, 71, f"+{br(o['desp'], 0)} L", fontsize=32, fontweight="bold", color=RED, ha="center")
    ax.text(50, 64.5, f"consumido {br(o['lt'], 0)} L  -  ideal {br(o['ideal'], 0)} L", fontsize=11, color=GREY, ha="center")
    ax.text(50, 59.5, f"{br(o['km'], 0)} km rodados no dia", fontsize=11, color=GREY, ha="center")
    ax.add_patch(FancyBboxPatch((67, 55), 30, 30, boxstyle="round,pad=0.5", fc=BG, ec=ED, lw=1.6))
    ax.text(82, 80.5, "COMPARATIVO KM/L", fontsize=12.5, color=DARK, ha="center", fontweight="bold")
    comp = [("Dia anterior", o["kprev"]), ("HOJE", kref), ("Mes (acum.)", o["acum"])]
    mx = max(c[1] for c in comp)
    for i, (lb, v) in enumerate(comp):
        x = 70.5 + i * 9; h = 16 * v / mx
        c = DARK if lb == "HOJE" else "#94a3b8"
        ax.add_patch(FancyBboxPatch((x, 59), 8, h, boxstyle="square,pad=0", fc=c, ec="none"))
        ax.text(x + 4, 59 + h + 1.2, br(v), fontsize=10.5, ha="center", color=DARK, fontweight="bold")
        ax.text(x + 4, 56.7, lb, fontsize=8.7, ha="center", color=GREY)

    def ranking(x, titulo, cor, dados):
        w = 45
        ax.add_patch(FancyBboxPatch((x, 6), w, 42, boxstyle="round,pad=0.5", fc="white", ec=cor, lw=2))
        ax.add_patch(FancyBboxPatch((x, 43.5), w, 4.5, boxstyle="round,pad=0.5", fc=cor, ec=cor, lw=0))
        ax.text(x + w / 2, 45.7, titulo, fontsize=13, fontweight="bold", color="white", ha="center", va="center")
        for i, (v, kl) in enumerate(dados):
            yy = 39 - i * 6.6
            ax.text(x + 3, yy, f"{i+1}o", fontsize=11, color=cor, fontweight="bold", va="center")
            ax.text(x + 8, yy, f"carro {v}", fontsize=11.5, color=DARK, va="center")
            ax.text(x + w - 9, yy, br(kl), fontsize=12.5, color=cor, fontweight="bold", va="center", ha="right")
            ax.text(x + w - 2, yy, "km/l", fontsize=8.5, color=GREY, va="center", ha="right")
    ranking(3, "MELHORES DO DIA", GREEN, o["melhores"])
    ranking(52, "PIORES DO DIA", RED, o["piores"])
    fig.savefig(path, dpi=150, facecolor="white", bbox_inches="tight"); plt.close(fig)


def render_evol(o, path):
    serie = o["serie"]
    if len(serie) < 3:
        return False
    dias = [d for d, _, _ in serie]; tr = [t for _, t, _ in serie]; te = [s for _, _, s in serie]
    x = list(range(len(dias)))
    fig, ax = plt.subplots(figsize=(15, 6.6))
    ax.plot(x, te, marker="s", ms=4.5, lw=2.2, ls="--", color=PURP, label="KM/L Telemetria (SST)", zorder=3)
    ax.plot(x, tr, marker="o", ms=5, lw=2.6, color=TEAL, label="KM/L Transnet (oficial)", zorder=3)
    ax.axhline(META, color="#94a3b8", lw=1.3, ls=":"); ax.text(0.2, META + 0.004, "meta 2,80", fontsize=9, color=GREY)
    for i in x:
        ax.annotate(br(tr[i]), (i, tr[i]), textcoords="offset points", xytext=(0, -13), ha="center", fontsize=7, color=TEAL, fontweight="bold")
        ax.annotate(br(te[i]), (i, te[i]), textcoords="offset points", xytext=(0, 9), ha="center", fontsize=7, color=PURP, fontweight="bold")
    ax.scatter([x[-1]], [tr[-1]], s=170, facecolor="none", edgecolor=RED, lw=2.2, zorder=5)
    ax.set_xticks(x); ax.set_xticklabels([d[8:10] + "/" + d[5:7] for d in dias], fontsize=8, rotation=45, ha="right")
    ax.set_ylabel("KM/L", fontsize=12); ax.set_ylim(min(min(tr), min(te)) - 0.08, max(max(tr), max(te)) + 0.12)
    ax.set_xlim(-0.6, len(dias) - 0.4)
    ax.set_title(f"Evolucao diaria do KM/L - Transnet x Telemetria  (ultimo: {data_br(dias[-1])})",
                 fontsize=15, fontweight="bold", color=DARK, pad=12)
    ax.legend(loc="upper left", fontsize=10.5, frameon=False)
    for sp in ["top", "right"]:
        ax.spines[sp].set_visible(False)
    ax.grid(axis="y", linestyle=":", alpha=0.35)
    fig.tight_layout(); fig.savefig(path, dpi=150, facecolor="white", bbox_inches="tight"); plt.close(fig)
    return True


def render_mensal(serie, path_chart, path_tab):
    if len(serie) < 2:
        return False
    labs = [MESNOME[m] for m, _, _ in serie]; tr = [t for _, t, _ in serie]; te = [e for _, _, e in serie]
    x = list(range(len(serie)))
    fig, ax = plt.subplots(figsize=(12.5, 6.2))
    ax.plot(x, te, marker="s", ms=8, lw=2.6, ls="--", color=PURP, label="Telemetria", zorder=3)
    ax.plot(x, tr, marker="o", ms=8, lw=2.8, color=TEAL, label="Transnet (oficial)", zorder=3)
    ax.axhline(META, color="#94a3b8", lw=1.4, ls=":"); ax.text(0.05, META + 0.004, "meta 2,80", fontsize=9.5, color=GREY)
    for i in x:
        ax.annotate(br(tr[i]), (i, tr[i]), textcoords="offset points", xytext=(0, -16), ha="center", fontsize=10, color=TEAL, fontweight="bold")
        ax.annotate(br(te[i]), (i, te[i]), textcoords="offset points", xytext=(0, 11), ha="center", fontsize=10, color=PURP, fontweight="bold")
    ax.set_xticks(x); ax.set_xticklabels(labs, fontsize=12)
    ax.set_ylabel("KM/L", fontsize=12); ax.set_ylim(min(tr + te) - 0.06, max(tr + te) + 0.06)
    ax.set_title("Evolucao mensal do KM/L - Transnet x Telemetria", fontsize=15, fontweight="bold", color=DARK, pad=12)
    ax.legend(loc="lower center", ncol=2, fontsize=11, frameon=False, bbox_to_anchor=(0.5, -0.16))
    for sp in ["top", "right"]:
        ax.spines[sp].set_visible(False)
    ax.grid(axis="y", linestyle=":", alpha=0.35)
    fig.tight_layout(); fig.savefig(path_chart, dpi=150, facecolor="white", bbox_inches="tight"); plt.close(fig)

    fig, ax = plt.subplots(figsize=(9.5, 6.0)); ax.axis("off"); ax.set_xlim(0, 100); ax.set_ylim(0, 100)
    ax.text(3, 96, "KM/L do ano - mes a mes", fontsize=17, fontweight="bold", color=DARK)
    cols = ["Mes", "Transnet", "Telemetria", "Dif.", "vs Meta"]; cx = [6, 32, 54, 76, 90]; y0 = 86; rh = 9.5
    ax.add_patch(FancyBboxPatch((3, y0 - rh + 1), 94, rh, boxstyle="square,pad=0", fc=DARK, ec="none"))
    for c, t in zip(cx, cols):
        ax.text(c, y0 - rh / 2 + 0.5, t, fontsize=11.5, color="white", fontweight="bold", va="center", ha=("left" if c == 6 else "center"))
    for i, (m, t, e) in enumerate(serie):
        yy = y0 - rh - i * rh
        ax.add_patch(FancyBboxPatch((3, yy - rh + 1), 94, rh, boxstyle="square,pad=0", fc=("#f8fafc" if i % 2 else "white"), ec="#e2e8f0", lw=0.8))
        ax.text(cx[0], yy - rh / 2 + 0.5, MESNOME[m], fontsize=11.5, color=DARK, va="center", fontweight="bold")
        ax.text(cx[1], yy - rh / 2 + 0.5, br(t, 3), fontsize=11.5, color=TEAL, va="center", ha="center", fontweight="bold")
        ax.text(cx[2], yy - rh / 2 + 0.5, br(e, 3), fontsize=11.5, color=PURP, va="center", ha="center", fontweight="bold")
        ax.text(cx[3], yy - rh / 2 + 0.5, f"+{(e-t)/t*100:.1f}%".replace(".", ","), fontsize=11, color=GREY, va="center", ha="center")
        ax.text(cx[4], yy - rh / 2 + 0.5, f"{t-META:+.2f}".replace(".", ","), fontsize=11, color=RED, va="center", ha="center", fontweight="bold")
    fig.savefig(path_tab, dpi=150, facecolor="white", bbox_inches="tight"); plt.close(fig)
    return True


def render_cluster(clusters, mes_atual, path):
    if not clusters:
        return False
    fig, ax = plt.subplots(figsize=(10, 6))
    names = [c[0] for c in clusters]; kml = [c[1] for c in clusters]; meta = [c[2] for c in clusters]; kms = [c[3] for c in clusters]
    x = np.arange(len(clusters))
    cols = [GREEN if k >= m else (AMBER if k >= m - 0.12 else RED) for k, m in zip(kml, meta)]
    ax.bar(x, kml, width=0.55, color=cols, edgecolor="#334155", lw=0.5, zorder=3)
    for i, (k, m, km) in enumerate(zip(kml, meta, kms)):
        ax.plot([i - 0.30, i + 0.30], [m, m], color=DARK, lw=2.2, zorder=4)
        ax.text(i, k + 0.006, br(k, 3), ha="center", fontsize=12, fontweight="bold", color=DARK)
        ax.text(i, 0.06, f"meta {br(m)}", ha="center", fontsize=9, color=GREY, transform=ax.get_xaxis_transform())
        ax.text(i, -0.13, f"{km/1000:.0f} mil km", ha="center", fontsize=8.5, color=GREY, transform=ax.get_xaxis_transform())
    ax.set_xticks(x); ax.set_xticklabels(names, fontsize=13, fontweight="bold")
    ax.set_ylim(min(kml + meta) - 0.14, max(kml + meta) + 0.05); ax.set_ylabel("KM/L (telemetria)", fontsize=11.5)
    ax.set_title(f"Como estamos por CLUSTER - {MESNOME[mes_atual]} (parcial)", fontsize=15, fontweight="bold", color=DARK, pad=12)
    ax.text(0.99, 0.96, "traco preto = meta do cluster", transform=ax.transAxes, ha="right", fontsize=9, color=GREY)
    for sp in ["top", "right"]:
        ax.spines[sp].set_visible(False)
    ax.grid(axis="y", linestyle=":", alpha=0.3)
    fig.tight_layout(); fig.savefig(path, dpi=150, facecolor="white", bbox_inches="tight"); plt.close(fig)
    return True


def render_linha(linhas, mes_atual, path):
    if not linhas:
        return False
    fig, ax = plt.subplots(figsize=(11, 8))
    names = [l[0] for l in linhas]; kml = [l[1] for l in linhas]; meta = [l[2] for l in linhas]
    y = np.arange(len(linhas))
    cols = [GREEN if k >= m else RED for k, m in zip(kml, meta)]
    ax.barh(y, kml, color=cols, edgecolor="#334155", lw=0.4, zorder=2, height=0.62)
    for i, (k, m) in enumerate(zip(kml, meta)):
        ax.plot([m, m], [i - 0.34, i + 0.34], color=DARK, lw=2, zorder=4)
        gap = k - m
        ax.text(k + 0.01, i, f"{br(k, 3)}  ({gap:+.2f})".replace(".", ","), va="center", fontsize=9.5,
                color=(GREEN if gap >= 0 else RED), fontweight="bold")
    ax.set_yticks(y); ax.set_yticklabels(names, fontsize=10.5, fontweight="bold"); ax.invert_yaxis()
    ax.set_xlim(min(kml + meta) - 0.05, max(kml + meta) + 0.22); ax.set_xlabel("KM/L (telemetria)", fontsize=11.5)
    ax.set_title(f"Como estamos por LINHA - {MESNOME[mes_atual]} (parcial)", fontsize=15, fontweight="bold", color=DARK, pad=12)
    ax.text(0.99, -0.075, "traco preto = meta  ·  verde = bate meta  ·  vermelho = abaixo  (gap ao lado)",
            transform=ax.transAxes, ha="right", fontsize=9, color=GREY)
    for sp in ["top", "right"]:
        ax.spines[sp].set_visible(False)
    ax.grid(axis="x", linestyle=":", alpha=0.3)
    fig.tight_layout(); fig.savefig(path, dpi=150, facecolor="white", bbox_inches="tight"); plt.close(fig)
    return True


# ---------------- MENSAGEM + ENVIO ----------------

def montar_msg(o):
    kref = o["kref"]; delta = kref - META
    emoji = "🟢" if delta >= 0 else "🔴"; sinal = "acima" if delta >= 0 else "abaixo"
    L = ["🚛 *DIESEL — RELATÓRIO DIÁRIO*",
         f"📅 Último dia consolidado: *{data_br(o['REF'])}*",
         "_(Transnet fecha em D-2)_", "",
         f"⛽ KM/L do dia: *{br(kref)}* — {emoji} {sinal} da meta ({br(META)})",
         f"📉 Desperdício: *+{br(o['desp'], 0)} L* no dia",
         f"📊 Ontem {br(o['kprev'])} · Hoje {br(kref)} · Mês {br(o['acum'])}"]
    if o["sem_abast"]:
        L.append(""); L.append(f"⚠️ *Rodou sem abastecimento ({len(o['sem_abast'])}):*")
        for v, p, km in o["sem_abast"]:
            L.append(f"   • {v}{(' ('+p+')') if p else ''} — {km} km")
    if o["diverg"]:
        L.append(""); L.append(f"🔍 *Divergência SST×Transnet >10% ({len(o['diverg'])}, 10 dias):*")
        for v, p, t, s, d in o["diverg"]:
            L.append(f"   • {v} — Transnet {br(t)} vs SST {br(s)} ({d:+.0f}%)".replace(".", ","))
    return "\n".join(L)


def enviar(msg, fotos):
    for cid in CHATS:
        r = requests.post(f"{API}/sendMessage", data={"chat_id": cid, "text": msg, "parse_mode": "Markdown"}, timeout=60)
        print(f"sendMessage[{cid}]:", r.json().get("ok"), r.json().get("description", ""))
        for path, cap in fotos:
            if not os.path.exists(path):
                continue
            with open(path, "rb") as fh:
                r = requests.post(f"{API}/sendPhoto", data={"chat_id": cid, "caption": cap}, files={"photo": fh}, timeout=120)
            print(f"sendPhoto[{cid}]", os.path.basename(path), r.json().get("ok"), r.json().get("description", ""))


def wa_upload(path):
    with open(path, "rb") as fh:
        r = requests.post(f"{WA_API}/media",
                          headers={"Authorization": f"Bearer {WA_TOKEN}"},
                          data={"messaging_product": "whatsapp", "type": "image/png"},
                          files={"file": (os.path.basename(path), fh, "image/png")}, timeout=120)
    j = r.json()
    if "id" not in j:
        print("wa_upload FALHOU:", os.path.basename(path), j)
    return j.get("id")


def wa_post(payload, rotulo, dest):
    r = requests.post(f"{WA_API}/messages",
                      headers={"Authorization": f"Bearer {WA_TOKEN}", "Content-Type": "application/json"},
                      json=payload, timeout=60)
    j = r.json()
    ok = "messages" in j
    print(f"whatsapp {rotulo}[{dest}]:", "ok" if ok else j.get("error", {}).get("message", j))
    return ok


def enviar_whatsapp(o, fotos):
    """Template aprovado (imagem no header + numeros no corpo) para cada destino.
    Fotos extras vao como mensagem livre: so entregam se o destino respondeu ha <24h
    (janela de atendimento da Meta); fora dela a API recusa e o report segue normal."""
    if not (WA_TOKEN and WA_PHONE_ID and WA_DESTINOS):
        return
    kref = o["kref"]; sinal = "acima" if kref - META >= 0 else "abaixo"
    corpo = [data_br(o["REF"]), br(kref), sinal, br(o["desp"], 0),
             br(o["kprev"]), br(kref), br(o["acum"])]
    slide_id = wa_upload(fotos[0][0]) if fotos else None
    extras_ids = [(wa_upload(p), cap) for p, cap in fotos[1:] if os.path.exists(p)]
    for dest in WA_DESTINOS:
        comps = []
        if slide_id:
            comps.append({"type": "header", "parameters": [{"type": "image", "image": {"id": slide_id}}]})
        comps.append({"type": "body", "parameters": [{"type": "text", "text": t} for t in corpo]})
        wa_post({"messaging_product": "whatsapp", "to": dest, "type": "template",
                 "template": {"name": WA_TEMPLATE, "language": {"code": WA_LANG}, "components": comps}},
                "template", dest)
        for mid, cap in extras_ids:
            if mid:
                wa_post({"messaging_product": "whatsapp", "to": dest, "type": "image",
                         "image": {"id": mid, "caption": cap}}, "foto-extra", dest)


def main():
    o = computar(carregar())
    if o is None:
        for cid in CHATS:
            requests.post(f"{API}/sendMessage",
                          data={"chat_id": cid, "text": "🚛 Diesel Diário: sem dados consolidados suficientes hoje."}, timeout=60)
        print("sem dados consolidados"); return
    render_slide(o, "diario_slide.png")
    fotos = [("diario_slide.png", f"Diesel Diário — {data_br(o['REF'])}")]
    if render_evol(o, "diario_evol.png"):
        fotos.append(("diario_evol.png", "Evolução KM/L Transnet x Telemetria"))

    # extras (best-effort: nunca derruba o nucleo)
    if BU and BK:
        try:
            e = computar_extras(*carregar_extras())
            if render_mensal(e["serie_mes"], "diario_mensal.png", "diario_mensal_tab.png"):
                fotos.append(("diario_mensal.png", "Evolução mensal do ano — Transnet x Telemetria"))
                fotos.append(("diario_mensal_tab.png", "KM/L do ano — mês a mês"))
            if render_cluster(e["clusters"], e["mes_atual"], "diario_cluster.png"):
                fotos.append(("diario_cluster.png", f"Como estamos por cluster — {MESNOME[e['mes_atual']]}"))
            if render_linha(e["linhas"], e["mes_atual"], "diario_linha.png"):
                fotos.append(("diario_linha.png", f"Como estamos por linha — {MESNOME[e['mes_atual']]}"))
        except Exception:
            print("EXTRAS falharam (segue so o nucleo):"); traceback.print_exc()

    enviar(montar_msg(o), fotos)
    try:
        enviar_whatsapp(o, fotos)
    except Exception:
        print("WHATSAPP falhou (Telegram ja foi):"); traceback.print_exc()
    print("OK - report enviado. REF =", o["REF"], "| fotos:", len(fotos))


if __name__ == "__main__":
    main()
