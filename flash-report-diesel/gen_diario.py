# -*- coding: utf-8 -*-
"""
Diesel - Relatorio Diario (Telegram).
Fonte: Base Transnet (indicadores_diesel) - KM/L oficial por veiculo/dia + telemetria SST.
Gera slide de KPIs + grafico de evolucao Transnet x Telemetria e envia no Telegram.
Roda no GitHub Actions todo dia 09h BRT. Credenciais 100% via secrets (env).
"""
import os, json, urllib.request, urllib.parse, datetime
from collections import defaultdict
import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
from matplotlib.patches import FancyBboxPatch
import numpy as np
import requests

META = 2.80
MIN_VEIC_CONSOLIDADO = 70          # dia so conta se >= N veiculos tem Transnet
JANELA_DIAS = 45                   # janela de busca
PREFIXO_IGNORAR = ("2216",)        # frota que nao entra na analise de divergencia

TU = os.environ["SUPABASE_TRANSNET_URL"].rstrip("/")
TK = os.environ["SUPABASE_TRANSNET_KEY"]
TG = os.environ["TELEGRAM_BOT_TOKEN"]
CID = os.environ["TELEGRAM_CHAT_ID"]
API = f"https://api.telegram.org/bot{TG}"

TEAL = "#0e7c7b"; PURP = "#7c3aed"; DARK = "#0f172a"; RED = "#c0392b"
GREEN = "#15803d"; GREY = "#64748b"; BG = "#f8fafc"; ED = "#dbe3ee"


def num(x):
    try:
        return float(x)
    except Exception:
        return None


def br(v, d=2):
    return f"{v:,.{d}f}".replace(",", "X").replace(".", ",").replace("X", ".")


def sb_get(path, params):
    rows, off = [], 0
    while True:
        q = urllib.parse.urlencode(params + [("limit", "1000"), ("offset", str(off))], safe="().,:-")
        req = urllib.request.Request(f"{TU}/rest/v1/{path}?{q}",
                                     headers={"apikey": TK, "Authorization": f"Bearer {TK}"})
        with urllib.request.urlopen(req, timeout=120) as r:
            b = json.loads(r.read().decode())
        rows += b
        if len(b) < 1000:
            break
        off += 1000
    return rows


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
        if ks and cs and cs > 0 and 1.0 <= ks / cs <= 4.5:   # telemetria filtrada
            d["ks"] += ks; d["cs"] += cs

    cons = sorted([x for x in dia if dia[x]["n"] >= MIN_VEIC_CONSOLIDADO])
    if len(cons) < 2:
        return None
    REF, PREV = cons[-1], cons[-2]
    kml = lambda x: dia[x]["km"] / dia[x]["lt"]

    mesref = REF[:7]
    dias_mes = [x for x in cons if x[:7] == mesref]
    akm = sum(dia[x]["km"] for x in dias_mes); alt = sum(dia[x]["lt"] for x in dias_mes)

    kmR, ltR = dia[REF]["km"], dia[REF]["lt"]
    ideal = kmR / META; desp = ltR - ideal

    vs = [(v, p, k / l) for v, p, k, l in dia[REF]["veic"] if k >= 100 and 1.0 <= k / l <= 4.0]
    vs.sort(key=lambda x: x[2])
    piores = vs[:5]; melhores = vs[-5:][::-1]

    # rodou na telemetria e sem abastecimento (Transnet) no dia REF
    sem_abast = []
    for r in dados:
        if r["data_consolidada"] != REF:
            continue
        ks = num(r["km_sst"]); ct = num(r["combustivel_transnet"])
        if ks and ks > 15 and (ct is None or ct == 0):
            sem_abast.append((r["veiculo"], round(ks)))
    sem_abast.sort(key=lambda x: -x[1])

    # divergencia SST x Transnet nos ultimos 10 dias consolidados
    ult10 = set(cons[-10:])
    ve = defaultdict(lambda: {"kt": 0., "ct": 0., "ks": 0., "cs": 0.})
    for r in dados:
        if r["data_consolidada"] not in ult10:
            continue
        v = str(r["veiculo"])
        if v.startswith(PREFIXO_IGNORAR):
            continue
        kt, ct = num(r["km_transnet"]), num(r["combustivel_transnet"])
        ks, cs = num(r["km_sst"]), num(r["combustivel_sst"])
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
            diverg.append((v, round(t, 2), round(s, 2), round(d, 1)))
    diverg.sort(key=lambda x: -abs(x[3]))

    serie = []
    for x in cons:
        a = dia[x]
        if a["cs"] > 0:
            t = a["km"] / a["lt"]; s = a["ks"] / a["cs"]
            if abs((s - t) / t * 100) <= 15:      # descarta glitch de telemetria
                serie.append((x, round(t, 3), round(s, 3)))

    return {
        "REF": REF, "PREV": PREV, "kref": round(kml(REF), 3), "kprev": round(kml(PREV), 3),
        "acum": round(akm / alt, 3), "km": round(kmR), "lt": round(ltR),
        "ideal": round(ideal), "desp": round(desp), "nveic": dia[REF]["n"],
        "piores": [(v, round(k, 2)) for v, p, k in piores],
        "melhores": [(v, round(k, 2)) for v, p, k in melhores],
        "sem_abast": sem_abast, "diverg": diverg, "serie": serie,
    }


def data_br(iso):
    return iso[8:10] + "/" + iso[5:7] + "/" + iso[:4]


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
    fig.savefig(path, dpi=150, facecolor="white", bbox_inches="tight")
    plt.close(fig)


def render_evol(o, path):
    serie = o["serie"]
    if len(serie) < 3:
        return False
    dias = [d for d, _, _ in serie]; tr = [t for _, t, _ in serie]; te = [s for _, _, s in serie]
    x = list(range(len(dias)))
    fig, ax = plt.subplots(figsize=(15, 6.6))
    ax.plot(x, te, marker="s", ms=4.5, lw=2.2, ls="--", color=PURP, label="KM/L Telemetria (SST)", zorder=3)
    ax.plot(x, tr, marker="o", ms=5, lw=2.6, color=TEAL, label="KM/L Transnet (oficial)", zorder=3)
    ax.axhline(META, color="#94a3b8", lw=1.3, ls=":")
    ax.text(0.2, META + 0.004, "meta 2,80", fontsize=9, color=GREY)
    for i in x:
        ax.annotate(br(tr[i]), (i, tr[i]), textcoords="offset points", xytext=(0, -13),
                    ha="center", fontsize=7, color=TEAL, fontweight="bold")
        ax.annotate(br(te[i]), (i, te[i]), textcoords="offset points", xytext=(0, 9),
                    ha="center", fontsize=7, color=PURP, fontweight="bold")
    li = x[-1]
    ax.scatter([li], [tr[li]], s=170, facecolor="none", edgecolor=RED, lw=2.2, zorder=5)
    lab = [d[8:10] + "/" + d[5:7] for d in dias]
    ax.set_xticks(x); ax.set_xticklabels(lab, fontsize=8, rotation=45, ha="right")
    ax.set_ylabel("KM/L", fontsize=12); ax.set_ylim(min(min(tr), min(te)) - 0.08, max(max(tr), max(te)) + 0.12)
    ax.set_xlim(-0.6, len(dias) - 0.4)
    ax.set_title(f"Evolucao diaria do KM/L - Transnet x Telemetria  (ultimo: {data_br(dias[-1])})",
                 fontsize=15, fontweight="bold", color=DARK, pad=12)
    ax.legend(loc="upper left", fontsize=10.5, frameon=False)
    for sp in ["top", "right"]:
        ax.spines[sp].set_visible(False)
    ax.grid(axis="y", linestyle=":", alpha=0.35)
    fig.tight_layout(); fig.savefig(path, dpi=150, facecolor="white", bbox_inches="tight")
    plt.close(fig)
    return True


def montar_msg(o):
    kref = o["kref"]; delta = kref - META
    sinal = "acima" if delta >= 0 else "abaixo"
    emoji = "🟢" if delta >= 0 else "🔴"
    L = []
    L.append("🚛 *DIESEL — RELATÓRIO DIÁRIO*")
    L.append(f"📅 Último dia consolidado: *{data_br(o['REF'])}*")
    L.append("_(Transnet fecha com ~3 dias de atraso)_")
    L.append("")
    L.append(f"⛽ KM/L do dia: *{br(kref)}* — {emoji} {sinal} da meta ({br(META)})")
    L.append(f"📉 Desperdício: *+{br(o['desp'], 0)} L* no dia")
    L.append(f"📊 Ontem {br(o['kprev'])} · Hoje {br(kref)} · Mês {br(o['acum'])}")
    if o["sem_abast"]:
        cs = ", ".join(f"{v} ({km}km)" for v, km in o["sem_abast"][:5])
        L.append("")
        L.append(f"⚠️ *Rodou sem abastecimento:* {len(o['sem_abast'])} carro(s) — {cs}")
    if o["diverg"]:
        L.append("")
        L.append(f"🔍 *Divergência SST×Transnet >10% (10 dias):* {len(o['diverg'])} carro(s)")
        top = o["diverg"][0]
        L.append(f"   maior: carro {top[0]} (Transnet {br(top[1])} vs SST {br(top[2])}, {top[3]:+.0f}%)".replace(".", ","))
    return "\n".join(L)


def enviar(msg, fotos):
    r = requests.post(f"{API}/sendMessage", data={"chat_id": CID, "text": msg, "parse_mode": "Markdown"}, timeout=60)
    print("sendMessage:", r.json().get("ok"), r.json().get("description", ""))
    for path, cap in fotos:
        if not os.path.exists(path):
            continue
        with open(path, "rb") as fh:
            r = requests.post(f"{API}/sendPhoto", data={"chat_id": CID, "caption": cap},
                              files={"photo": fh}, timeout=120)
        print("sendPhoto", os.path.basename(path), r.json().get("ok"), r.json().get("description", ""))


def main():
    dados = carregar()
    o = computar(dados)
    if o is None:
        requests.post(f"{API}/sendMessage",
                      data={"chat_id": CID, "text": "🚛 Diesel Diário: sem dados consolidados suficientes hoje."},
                      timeout=60)
        print("sem dados consolidados")
        return
    slide = "diario_slide.png"; evol = "diario_evol.png"
    render_slide(o, slide)
    tem_evol = render_evol(o, evol)
    fotos = [(slide, f"Diesel Diário — {data_br(o['REF'])}")]
    if tem_evol:
        fotos.append((evol, "Evolução KM/L Transnet x Telemetria"))
    enviar(montar_msg(o), fotos)
    print("OK - report enviado. REF =", o["REF"])


if __name__ == "__main__":
    main()
