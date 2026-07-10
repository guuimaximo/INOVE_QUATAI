# Monta o HTML (paginas, A4 paisagem) do Flash Report Diesel v3 e converte pra PDF.
from pathlib import Path
import importlib.util

OUT = Path(__file__).resolve().parent
spec = importlib.util.spec_from_file_location("gfd3", OUT / "gen_flash_diesel_v3.py")
gfd = importlib.util.module_from_spec(spec)
import sys
sys.modules["gfd3"] = gfd
spec.loader.exec_module(gfd)

fmt = gfd.fmt
pct = gfd.pct
SEM = getattr(gfd, "SEMANA_ATUAL_LABEL", "28/06 a 03/07")  # janela recente (Pags 9 e 12)
MESREF = getattr(gfd, "MES_REF_LABEL", "Junho de 2026")     # ex.: "Julho/2026"
MESANT = getattr(gfd, "MES_ANT_LABEL", "Maio/2026")         # ex.: "Junho/2026"
MESREF_NOME, MESANT_NOME = MESREF.split("/")[0], MESANT.split("/")[0]
PERIODO = getattr(gfd, "PERIODO_LABEL", "01/06 a 30/06/2026")
_M3 = getattr(gfd, "_MES3", ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"])
MES3REF = _M3[getattr(gfd, "MES_REF_MM", 6) - 1]   # "Jul"
MES3ANT = _M3[getattr(gfd, "MES_ANT_MM", 5) - 1]   # "Jun"

TOTAL_PAGINAS = 19

CSS = """
* { box-sizing: border-box; }
body { margin:0; font-family: Arial, Helvetica, sans-serif; background:#eef2f7; color:#111827; }
.page { width:297mm; height:204mm; overflow:hidden; margin:0 auto; background:linear-gradient(180deg,#ffffff 0%,#fbfcfe 100%); padding:4mm 10mm 8mm 10mm; position:relative; }
.page-break { page-break-before: always; }
.header { display:flex; justify-content:space-between; align-items:flex-start; border-bottom:4px solid #0f172a; padding-bottom:6px; margin-bottom:8px; }
.title h1 { margin:0; font-size:21px; color:#0f172a; }
.title .sub { margin-top:3px; font-size:9.5px; color:#475569; }
.period-box { min-width:200px; text-align:right; background:linear-gradient(135deg,#0f172a 0%,#0e7c7b 100%); color:white; padding:8px 12px; border-radius:12px; }
.period-box .ref { font-size:8.5px; text-transform:uppercase; font-weight:700; opacity:.85; }
.period-box .val { font-size:14px; font-weight:800; margin-top:2px; }
.grid-2 { display:grid; grid-template-columns:1fr 1fr; gap:10px; margin-bottom:8px; }
.grid-3 { display:grid; grid-template-columns:1fr 1fr 1fr; gap:10px; margin-bottom:8px; }
.grid-4 { display:grid; grid-template-columns:1fr 1fr 1fr 1fr; gap:10px; margin-bottom:8px; }
.card { border:1px solid #dbe3ee; border-radius:12px; overflow:hidden; background:#fff; }
.card-title { padding:6px 12px; background:linear-gradient(90deg,#0e7c7b 0%,#0f172a 100%); color:white; font-size:9.5px; font-weight:800; text-transform:uppercase; letter-spacing:.5px; }
.card-body { padding:8px 10px; }
table { width:100%; border-collapse:collapse; font-size:8.4px; }
th { background:#eef2f7; color:#0f172a; text-transform:uppercase; font-size:7.4px; padding:3px 4px; border:1px solid #dbe3ee; text-align:center; }
td { padding:3px 4px; border:1px solid #dbe3ee; text-align:center; }
.tbl-compact td, .tbl-compact th { padding:2px 4px; font-size:7.6px; }
.tbl-big td, .tbl-big th { padding:7px 8px; font-size:10.5px; }
.tbl-big th { font-size:9px; }
.chart-wrap-md img { max-height:68mm; width:auto; max-width:100%; }
.metric { border:1px solid #dbe3ee; border-radius:10px; padding:7px; background:#f8fafc; text-align:center; }
.metric .lbl { font-size:8px; color:#64748b; text-transform:uppercase; font-weight:800; }
.metric .val { margin-top:2px; font-size:15px; font-weight:800; color:#0f172a; }
.metric .aux { margin-top:2px; font-size:7.5px; color:#64748b; }
.chart-wrap { padding:6px; border:1px solid #dbe3ee; border-radius:12px; background:#fff; text-align:center; }
.chart-wrap img { width:100%; height:auto; }
.chart-wrap-sm img { max-height:78mm; width:auto; max-width:100%; }
.cons-box { margin-top:6px; border:1px solid #dbe3ee; border-radius:12px; background:#f8fafc; padding:6px 12px; }
.cons-title { font-size:8.5px; font-weight:800; text-transform:uppercase; margin-bottom:3px; color:#0f172a; }
.cons-text { font-size:9px; line-height:1.32; color:#1f2937; text-align:justify; }
.footer { position:absolute; left:10mm; right:10mm; bottom:3mm; font-size:7.5px; color:#64748b; display:flex; justify-content:space-between; border-top:1px solid #dbe3ee; padding-top:3px; }
.warn { background:#fef9c3; border:1px solid #eab308; color:#854d0e; border-radius:10px; padding:6px 12px; font-size:9px; margin-bottom:6px; }
.badge-oficial { display:inline-block; background:#0e7c7b; color:white; font-size:8px; font-weight:800; padding:2px 8px; border-radius:999px; margin-left:6px; }
.placeholder { border:2px dashed #94a3b8; border-radius:12px; padding:20px; text-align:center; color:#64748b; background:#f8fafc; }
.placeholder b { color:#0f172a; }
@page { size: A4 landscape; margin:0; }
"""

def page_header(titulo_pag, sub, ref_label, ref_val):
    return f"""<div class="header">
    <div class="title"><h1>CONDUÇÃO ECONÔMICA — FLASH REPORT DIESEL</h1>
      <div class="sub">{titulo_pag}</div>
      <div class="sub">{sub}</div></div>
    <div class="period-box"><div class="ref">{ref_label}</div><div class="val">{ref_val}</div></div>
  </div>"""

def footer(pagina):
    return f"""<div class="footer"><div>Gerado automaticamente via Cowork · Página {pagina}/{TOTAL_PAGINAS}</div><div>Flash Report Diesel — Transnet oficial + Telemetria</div></div>"""

periodo_label = f"{PERIODO} · {MESREF} · comparações vs {MESANT}"

pages = []

# [COWORK] CALENDARIO NOTURNO — ajuste ano/mes e as datas em _visita_label (ver COWORK_FLASH.md)
# ---- calendario de visitas noturnas ----
import calendar as _cal
_cal_c = _cal.Calendar(firstweekday=6)
_weeks_jul = _cal_c.monthdayscalendar(2026, 7)
_dias_cols = ["Dom","Seg","Ter","Qua","Qui","Sex","S\u00e1b"]
_visita_label = {6: "1\u00aa visita", 17: "2\u00aa visita", 31: "3\u00aa visita"}
_cal_header = "".join(f'<div style="text-align:center;font-size:8px;font-weight:800;color:#64748b;text-transform:uppercase;padding:4px 0;">{d}</div>' for d in _dias_cols)
_cal_cells = ""
for _week in _weeks_jul:
    for _day in _week:
        if _day == 0:
            _cal_cells += '<div></div>'
        elif _day in _visita_label:
            _cal_cells += (f'<div style="border-radius:8px;background:#0e7c7b;color:#fff;padding:5px 3px;text-align:center;">'
                           f'<div style="font-size:13px;font-weight:800;">{_day}</div>'
                           f'<div style="font-size:6.4px;font-weight:700;margin-top:1px;">{_visita_label[_day]}</div></div>')
        else:
            _cal_cells += (f'<div style="border:1px solid #e2e8f0;border-radius:8px;padding:5px 3px;text-align:center;color:#334155;">'
                           f'<div style="font-size:11px;font-weight:600;">{_day}</div></div>')
CAL_JULHO_HEADER = _cal_header
CAL_JULHO_CELLS = _cal_cells


# ================= PAGINA 0: CAPA =================
pages.append(f"""<div class="page" style="background:linear-gradient(135deg,#0f172a 0%,#0e7c7b 100%); color:white; display:flex; flex-direction:column; justify-content:center; align-items:center; text-align:center; padding:0;">
  <svg width="150" height="90" viewBox="0 0 200 120" style="margin-bottom:10px;">
    <rect x="8" y="28" width="184" height="62" rx="14" fill="#ffffff" opacity="0.95"/>
    <rect x="8" y="28" width="184" height="20" rx="10" fill="#a7f3d0"/>
    <rect x="20" y="52" width="26" height="20" rx="3" fill="#0e7c7b"/>
    <rect x="52" y="52" width="26" height="20" rx="3" fill="#0e7c7b"/>
    <rect x="84" y="52" width="26" height="20" rx="3" fill="#0e7c7b"/>
    <rect x="116" y="52" width="26" height="20" rx="3" fill="#0e7c7b"/>
    <rect x="148" y="52" width="30" height="20" rx="3" fill="#0f172a"/>
    <rect x="8" y="76" width="184" height="8" fill="#0f172a"/>
    <circle cx="42" cy="98" r="13" fill="#0f172a"/>
    <circle cx="42" cy="98" r="5.5" fill="#cbd5e1"/>
    <circle cx="158" cy="98" r="13" fill="#0f172a"/>
    <circle cx="158" cy="98" r="5.5" fill="#cbd5e1"/>
    <rect x="8" y="28" width="184" height="62" rx="14" fill="none" stroke="#0e7c7b" stroke-width="2"/>
  </svg>
  <div style="font-size:13px; letter-spacing:4px; font-weight:700; opacity:.8; margin-bottom:14px;">GRUPO CSC · EXPRESSO PLANALTO S/A</div>
  <div style="font-size:40px; font-weight:900; letter-spacing:1px;">CONDUÇÃO ECONÔMICA</div>
  <div style="font-size:22px; font-weight:700; margin-top:6px; color:#a7f3d0;">FLASH REPORT DIESEL</div>
  <div style="margin-top:26px; font-size:15px; font-weight:700; background:rgba(255,255,255,.12); padding:8px 26px; border-radius:999px;">{MESREF}</div>
  <div style="margin-top:34px; display:flex; gap:34px;">
    <div style="text-align:center;"><div style="font-size:9px; opacity:.75; text-transform:uppercase; letter-spacing:1px;">Fonte oficial</div><div style="font-size:16px; font-weight:800;">Transnet</div></div>
    <div style="text-align:center;"><div style="font-size:9px; opacity:.75; text-transform:uppercase; letter-spacing:1px;">Comparação</div><div style="font-size:16px; font-weight:800;">Telemetria</div></div>
    <div style="text-align:center;"><div style="font-size:9px; opacity:.75; text-transform:uppercase; letter-spacing:1px;">Meta operacional</div><div style="font-size:16px; font-weight:800;">{fmt(gfd.META,2)} km/L</div></div>
  </div>
  <div style="position:absolute; bottom:14mm; font-size:8.5px; opacity:.65;">Gerado automaticamente via Cowork · Agente Diesel · Tratativas · Instrutores · Meritocracia</div>
</div>""")

# ================= PAGINA 1: HISTORICO 6+ MESES + RESUMO =================
var_jun = (gfd.KML_HISTORICO[-1][1] - gfd.KML_HISTORICO[-2][1]) / gfd.KML_HISTORICO[-2][1] * 100
_telem_key = gfd._MES3[gfd.MES_REF_MM - 1].lower()
_telem_val = gfd.KML_MENSAL_TELEMETRIA.get(_telem_key, list(gfd.KML_MENSAL_TELEMETRIA.values())[-1])
pages.append(f"""<div class="page-break"></div><div class="page">
  {page_header("Página 2 · KM/L Mensal — Histórico 7 Meses (Transnet oficial)", f"Período: <b>{periodo_label}</b>", "Mês de referência", MESREF)}
  <div class="grid-2">
    <div class="card"><div class="card-title">Evolução Mensal — Transnet</div><div class="card-body">
      <div class="chart-wrap"><img src="v3_historico.png"/></div>
    </div></div>
    <div class="card"><div class="card-title">Resumo Executivo</div><div class="card-body">
      <div class="grid-2">
        <div class="metric"><div class="lbl">KM/L {MESREF_NOME} (Transnet)<span class="badge-oficial">OFICIAL</span></div><div class="val">{fmt(gfd.KML_HISTORICO[-1][1],3)}</div><div class="aux">vs {fmt(gfd.KML_HISTORICO[-2][1],3)} em {MESANT_NOME.lower()} ({pct(var_jun)})</div></div>
        <div class="metric"><div class="lbl">KM/L {MESREF_NOME} (Telemetria)</div><div class="val">{fmt(_telem_val,3)}</div><div class="aux">Fonte de comparação</div></div>
      </div>
      <div class="metric" style="margin-top:8px;"><div class="lbl">Meta operacional</div><div class="val">{fmt(gfd.META,2)} km/L</div></div>
      <div class="metric" style="margin-top:8px;"><div class="lbl">Melhor mês do histórico</div><div class="val">{max(gfd.KML_HISTORICO,key=lambda m:m[1])[0]}</div><div class="aux">{fmt(max(gfd.KML_HISTORICO,key=lambda m:m[1])[1],3)} km/L</div></div>
    </div></div>
  </div>
  <div class="card"><div class="card-title">Evolução da Variação Semanal (%) — Transnet</div><div class="card-body">
    <div class="chart-wrap chart-wrap-sm"><img src="v3_semanal_pct.png"/></div>
  </div></div>
  <div class="cons-box"><div class="cons-title">Considerações</div>
  <div class="cons-text">Nos últimos 7 meses a frota oscilou entre {fmt(min(m[1] for m in gfd.KML_HISTORICO),3)} e {fmt(max(m[1] for m in gfd.KML_HISTORICO),3)} km/L pelo Transnet, sempre abaixo da meta de {fmt(gfd.META,2)}. Semana a semana, a variação alterna entre altas e quedas de forma errática (sem tendência clara de piora ou melhora contínua), o que sugere que o problema é estrutural (linhas/trânsito) e não um evento pontual recente.</div></div>
  {footer(2)}
</div>""")

# ================= PAGINA 2: EVOLUCAO SEMANAL + CLUSTER =================
rows_cluster_transnet = ""
for c in gfd.CLUSTER_TRANSNET:
    var = ((c[2]-c[1])/c[1]*100) if c[1] else 0
    rows_cluster_transnet += (f"<tr><td style='font-weight:bold;text-align:left;padding-left:6px;'>{c[0]}</td>"
                               f"<td>{fmt(c[1],3)}</td><td style='font-weight:700;'>{fmt(c[2],3)}</td>"
                               f"<td style='color:{'#16a34a' if var>0 else '#dc2626'};font-weight:bold;'>{pct(var)}</td></tr>")

pages.append(f"""<div class="page-break"></div><div class="page">
  {page_header("Página 3 · KM/L por Cluster de Frota (Transnet oficial)", f"Período: <b>{periodo_label}</b> · Cluster = agrupamento de veículos (veiculos_ativos)", "Mês de referência", MESREF)}
  <div class="card"><div class="card-title">KM/L por Cluster de Frota — últimos 4 meses</div><div class="card-body">
    <div class="chart-wrap"><img src="v3_cluster.png"/></div>
  </div></div>
  <div class="grid-2">
    <div class="card"><div class="card-title">Detalhamento por cluster ({MESANT_NOME} → {MESREF_NOME})</div><div class="card-body">
      <table class="tbl-big"><thead><tr><th style="text-align:left;padding-left:10px;">Cluster</th><th>KM/L {MES3ANT}</th><th>KM/L {MES3REF}</th><th>Variação</th></tr></thead>
      <tbody>{rows_cluster_transnet.replace("padding-left:6px", "padding-left:10px")}</tbody></table>
    </div></div>
    <div class="card"><div class="card-title">Leitura por cluster</div><div class="card-body">
      <div class="cons-box" style="margin-top:0;"><div class="cons-title">Cluster mais crítico</div>
      <div class="cons-text">C6 é o cluster com pior KM/L de forma consistente nos 4 meses (2,37–2,40), bem abaixo da meta de 2,80 — não é um evento pontual, e sim um padrão estrutural do cluster (veículo/linha) que merece investigação dedicada.</div></div>
      <div class="cons-box"><div class="cons-title">Melhor evolução e mais perto da meta</div>
      <div class="cons-text">C9 e C11 são os únicos com evolução positiva no mês (+0,61% e +0,09%). C10 e C11 seguem os clusters mais próximos da meta de 2,80 km/L (~2,75-2,78), enquanto C6 e C8 permanecem estruturalmente abaixo dela.</div></div>
    </div></div>
  </div>
  {footer(3)}
</div>""")

# ================= PAGINA 4: LINHA VS META + VELOCIDADE (formato completo) =================
kml_ref_medio = sum(l[7] for l in gfd.LINHA_DESPERDICIO) / sum(l[6]/l[2] for l in gfd.LINHA_DESPERDICIO)
kml_comp_medio = sum(l[1]*l[6] for l in gfd.LINHA_DESPERDICIO) / sum(l[6] for l in gfd.LINHA_DESPERDICIO)
kml_ref_pond = sum(l[6] for l in gfd.LINHA_DESPERDICIO) / sum(l[7] for l in gfd.LINHA_DESPERDICIO)
var_geral = (kml_ref_pond - kml_comp_medio) / kml_comp_medio * 100
desperdicio_total = sum(l[5] for l in gfd.LINHA_DESPERDICIO)

rows_linha_completa = ""
for l in sorted(gfd.LINHA_DESPERDICIO, key=lambda l: -l[5]):
    nome, kml_mai, kml_jun, var, meta, desp, km, lit = l
    cor_var = "#16a34a" if var >= 0 else "#dc2626"
    seta = "&#8593;" if var >= 0 else "&#8595;"
    cor_desp = "#dc2626" if desp > 0 else "#16a34a"
    rows_linha_completa += (f"<tr><td style='font-weight:bold;text-align:left;padding-left:6px;'>{nome}</td>"
                             f"<td>{fmt(kml_mai,2)}</td><td style='font-weight:700;'>{fmt(kml_jun,2)}</td>"
                             f"<td style='color:{cor_var};font-weight:700;'>{seta} {fmt(abs(var),2)}%</td>"
                             f"<td>{fmt(meta,2)}</td>"
                             f"<td style='font-weight:800;color:{cor_desp};'>{fmt(desp,2)} L</td>"
                             f"<td>{km:,}".replace(",",".") + f"</td><td>{fmt(lit,2)} L</td></tr>")

pages.append(f"""<div class="page-break"></div><div class="page">
  {page_header("Página 4 · Análise por Linha — KM/L, Meta e Desperdício ({MES3REF} vs {MES3ANT})", "Fonte: premiacao_diaria_atualizada (Telemetria)", "Linhas monitoradas", str(len(gfd.LINHA_DESPERDICIO)))}
  <div class="grid-4">
    <div class="metric"><div class="lbl">KM/L Mês Referência</div><div class="val">{fmt(kml_ref_pond,2)}</div></div>
    <div class="metric"><div class="lbl">KM/L Mês Comparação</div><div class="val">{fmt(kml_comp_medio,2)}</div></div>
    <div class="metric"><div class="lbl">Variação vs comparação</div><div class="val" style="color:{'#16a34a' if var_geral>=0 else '#dc2626'};">{pct(var_geral)}</div></div>
    <div class="metric"><div class="lbl">Desperdício Total (Meta)</div><div class="val" style="color:#dc2626;">{fmt(desperdicio_total,2)} L</div></div>
  </div>
  <div class="card"><div class="card-title">Detalhamento por linha ({MESREF_NOME} = referência, {MESANT_NOME} = comparação)</div><div class="card-body">
    <table class="tbl-big"><thead><tr><th style="text-align:left;padding-left:10px;">Linha</th><th>KM/L Comp.</th><th>KM/L Ref.</th><th>Var. %</th><th>Meta</th><th>Desperdício</th><th>Km</th><th>Comb.</th></tr></thead>
    <tbody>{rows_linha_completa.replace("padding-left:6px", "padding-left:10px")}</tbody></table>
  </div></div>
  <div class="grid-3" style="margin-top:8px;">
    <div class="cons-box" style="margin-top:0;"><div class="cons-title">Piores linhas (maior desperdício)</div>
    <div class="cons-text" style="font-size:10px;"><b>07TR</b> (1.588,97 L)<br/><b>08TR</b> (901,83 L)<br/><b>09TR</b> (695,26 L)</div></div>
    <div class="cons-box" style="margin-top:0;"><div class="cons-title">Melhores linhas (maior evolução Mai→Jun)</div>
    <div class="cons-text" style="font-size:10px;"><b>16TR</b> (+7,32%)<br/><b>02TR</b> (+3,91%)<br/><b>08TR</b> (+1,88%)</div></div>
    <div class="cons-box" style="margin-top:0;"><div class="cons-title">Linhas que mais pioraram</div>
    <div class="cons-text" style="font-size:10px;"><b>11TR</b> (-2,88%)<br/><b>07TR</b> (-2,81%)<br/><b>15TR</b> (-2,36%)</div></div>
  </div>
  {footer(4)}
</div>""")

# ================= PAGINA 4b: DISTANCIA DA META x VELOCIDADE (grafico que o usuario gostou) =================
pages.append(f"""<div class="page-break"></div><div class="page">
  {page_header("Página 5 · Distância da Meta por Linha, com Velocidade Média", "Fonte: premiacao_diaria_atualizada (Telemetria) — Junho/2026", "Linhas monitoradas", str(len(gfd.LINHAS)))}
  <div class="card"><div class="card-title">Distância da meta por linha, cruzada com velocidade média</div><div class="card-body">
    <div class="chart-wrap"><img src="v3_linha_meta.png"/></div>
  </div></div>
  <div class="cons-box"><div class="cons-title">Considerações</div>
  <div class="cons-text">As linhas mais distantes da meta (07TR, 20TR, 04TR, 05TR) também têm as velocidades médias mais baixas da frota (15-17 km/h), reforçando a hipótese de que trânsito/paradas explicam parte do desperdício — não apenas condução. Linhas com velocidade mais alta (02TR a 20,3 km/h, 03TR) batem ou superam a meta. Vale validar com a equipe de tráfego antes de cobrar apenas dos motoristas nas linhas mais lentas.</div></div>
  {footer(5)}
</div>""")

# ================= PAGINA 5b: VELOCIDADE MEDIA DIARIA x KM/L (correlacao) =================
pages.append(f"""<div class="page-break"></div><div class="page">
  {page_header("Página 6 · Velocidade Média Diária x KM/L — Correlação", f"Fonte: premiacao_diaria_atualizada (Telemetria) — {PERIODO}", "Dias analisados", str(len(gfd.KML_VELOCIDADE_DIARIO)))}
  <div class="card"><div class="card-title">KM/L diário x Velocidade média diária</div><div class="card-body">
    <div class="chart-wrap"><img src="v3_vel_kml_diario.png"/></div>
  </div></div>
  <div class="cons-box"><div class="cons-title">Considerações</div>
  <div class="cons-text">Correlação forte e positiva: os dias com velocidade média mais alta (acima de ~18 km/h, tipicamente com menos trânsito) apresentam KM/L nitidamente maior. Isso reforça que trânsito/parada explica parte do desperdício, ajudando a entender por que as linhas urbanas mais lentas ficam distantes da meta.</div></div>
  {footer(6)}
</div>""")

# ================= PAGINA 4: TOP 10 PIORES =================
def rows_ranking(data):
    out = ""
    for d in data:
        km_fmt = f"{int(d[4]):,}".replace(",", ".")
        out += (f"<tr><td style='text-align:left;padding-left:6px;'>{d[0].title()}</td>"
                f"<td>{d[1]}</td><td style='font-weight:700;'>{fmt(d[2],3)}</td>"
                f"<td>{fmt(d[3],2)}</td><td>{km_fmt}</td><td>{fmt(d[5],0)}</td></tr>")
    return out

def rows_ranking_com_historico(data):
    out = ""
    for d in data:
        km_fmt = f"{int(d[4]):,}".replace(",", ".")
        hist = gfd.PIORES_HISTORICO.get(d[1], ("-", "-", "-", "-", "-"))
        status_ac, data_ac, status_tr, data_tr, prio_tr = hist
        out += (f"<tr><td style='text-align:left;padding-left:6px;'>{d[0].title()}</td>"
                f"<td>{d[1]}</td><td style='font-weight:700;'>{fmt(d[2],3)}</td>"
                f"<td>{fmt(d[3],2)}</td>"
                f"<td style='font-size:7.4px;'>{status_ac} ({data_ac})</td>"
                f"<td style='font-size:7.4px;'>{status_tr} ({data_tr}, {prio_tr})</td></tr>")
    return out
rows_piores = rows_ranking_com_historico(gfd.PIORES)
rows_melhores = rows_ranking(gfd.MELHORES)

pages.append(f"""<div class="page-break"></div><div class="page">
  {page_header("Página 7 · Top 10 — Maior Distância da Meta (Junho)", f"Período: <b>{periodo_label}</b>", "Mês de referência", MESREF)}
  <div class="grid-2">
    <div class="card"><div class="card-title">Top 10 — Maior distância da meta</div><div class="card-body">
      <div class="chart-wrap chart-wrap-sm"><img src="v3_piores.png"/></div>
    </div></div>
    <div class="card"><div class="card-title">Detalhamento — com último acompanhamento e última tratativa</div><div class="card-body">
      <table class="tbl-big"><thead><tr><th style="text-align:left;padding-left:10px;">Motorista</th><th>Chapa</th><th>KM/L Real</th><th>Meta</th><th>Último Acompanhamento</th><th>Última Tratativa</th></tr></thead>
      <tbody>{rows_piores.replace("padding-left:6px", "padding-left:10px").replace("font-size:7.4px", "font-size:8.6px")}</tbody></table>
      <div class="cons-box"><div class="cons-title">Leitura</div>
      <div class="cons-text">Dos 10 motoristas mais distantes da meta em Junho, a maioria já está em algum estágio de acompanhamento ou tratativa — o desafio não é falta de ação, mas a velocidade de conversão desses casos em melhoria efetiva de KM/L.</div></div>
    </div></div>
  </div>
  {footer(7)}
</div>""")

# ================= PAGINA 5: TOP 10 MELHORES + SINAL DE ALERTA =================
rows_alerta = ""
for a in gfd.SINAL_ALERTA:
    rows_alerta += (f"<tr><td style='text-align:left;padding-left:6px;'>{a[0].title()}</td>"
                     f"<td>{fmt(a[1],3)}</td><td>{fmt(a[2],3)}</td>"
                     f"<td style='color:#dc2626;font-weight:800;'>{pct(a[3])}</td></tr>")

rows_alerta_causa = ""
for c in gfd.SINAL_ALERTA_CAUSA:
    nome, l_mai, l_jun, c_mai, c_jun, mudou_linha, mudou_carro = c
    if mudou_linha is None:
        causa = "Sem dado suficiente"
    elif mudou_linha and mudou_carro:
        causa = "Trocou de linha e de carro"
    elif mudou_carro:
        causa = "Trocou de carro (mesma linha)"
    elif mudou_linha:
        causa = "Trocou de linha (mesmo carro)"
    else:
        causa = "Sem troca — provável fator comportamental"
    cor = "#e0a800" if (mudou_linha or mudou_carro) else "#dc2626"
    rows_alerta_causa += (f"<tr><td style='text-align:left;padding-left:6px;'>{nome}</td>"
                          f"<td>{l_mai} → {l_jun}</td><td>{c_mai} → {c_jun}</td>"
                          f"<td style='text-align:left;font-size:7.6px;color:{cor};font-weight:700;'>{causa}</td></tr>")

pages.append(f"""<div class="page-break"></div><div class="page">
  {page_header("Página 8 · Top 10 Melhores e Sinal de Alerta (Mai→Jun)", f"Período: <b>{periodo_label}</b>", "Mês de referência", MESREF)}
  <div class="grid-2">
    <div class="card"><div class="card-title">Top 10 — Melhor desempenho (Junho)</div><div class="card-body">
      <div class="chart-wrap"><img src="v3_melhores.png"/></div>
    </div></div>
    <div class="card"><div class="card-title">Sinal de Alerta — maior queda {MESANT_NOME}→{MESREF_NOME}</div><div class="card-body">
      <div class="chart-wrap"><img src="v3_alerta.png"/></div>
    </div></div>
  </div>
  <div class="grid-2">
    <div class="card"><div class="card-title">Detalhamento — Top 10 melhores</div><div class="card-body">
      <table class="tbl-compact"><thead><tr><th style="text-align:left;padding-left:6px;">Motorista</th><th>Chapa</th><th>KM/L Real</th><th>Meta</th><th>Km</th><th>Comb.</th></tr></thead>
      <tbody>{rows_melhores}</tbody></table>
    </div></div>
    <div class="card"><div class="card-title">Sinal de Alerta — a queda foi por troca de linha/carro ou comportamento?</div><div class="card-body">
      <table class="tbl-compact"><thead><tr><th style="text-align:left;padding-left:6px;">Motorista</th><th>Linha {MES3ANT}→{MES3REF}</th><th>Carro {MES3ANT}→{MES3REF}</th><th>Causa provável</th></tr></thead>
      <tbody>{rows_alerta_causa}</tbody></table>
    </div></div>
  </div>
  {footer(8)}
</div>""")

# ================= PAGINA 6: DESTAQUE POSITIVO + MOTORISTAS DA SEMANA =================
rows_destaque = ""
for a in gfd.DESTAQUE_POSITIVO:
    rows_destaque += (f"<tr><td style='text-align:left;padding-left:6px;'>{a[0].title()}</td>"
                       f"<td>{fmt(a[1],3)}</td><td>{fmt(a[2],3)}</td>"
                       f"<td style='color:#16a34a;font-weight:800;'>{pct(a[3])}</td></tr>")

rows_semana = ""
for m in gfd.MOTORISTAS_SEMANA:
    rows_semana += (f"<tr><td style='text-align:left;padding-left:6px;'>{m[0].title()}</td><td>{m[1]}</td>"
                     f"<td>{m[2]}</td><td>{m[3]}</td><td style='text-align:left;font-size:7.6px;'>{m[4]}</td></tr>")

pages.append(f"""<div class="page-break"></div><div class="page">
  {page_header("Página 9 · Destaque Positivo e Motoristas da Semana", f"Período: <b>{periodo_label}</b>", "Mês de referência", MESREF)}
  <div class="grid-2">
    <div class="card"><div class="card-title">Destaque Positivo — maior evolução {MESANT_NOME}→{MESREF_NOME}</div><div class="card-body">
      <div class="chart-wrap chart-wrap-sm"><img src="v3_destaque.png"/></div>
      <table class="tbl-compact" style="margin-top:5px;"><thead><tr><th style="text-align:left;padding-left:6px;">Motorista</th><th>KM/L {MES3ANT}</th><th>KM/L {MES3REF}</th><th>Variação</th></tr></thead>
      <tbody>{rows_destaque}</tbody></table>
    </div></div>
    <div class="card"><div class="card-title">Motoristas da Semana — foco de acompanhamento ({SEM})</div><div class="card-body">
      <table class="tbl-big"><thead><tr><th style="text-align:left;padding-left:10px;">Motorista</th><th>Chapa</th><th>Instrutor</th><th>Data</th><th style="text-align:left;">Foco</th></tr></thead>
      <tbody>{rows_semana.replace("padding-left:6px", "padding-left:10px")}</tbody></table>
      <div class="cons-box"><div class="cons-title">Leitura da semana</div>
      <div class="cons-text">A carteira desta semana é dividida quase igualmente entre Fabiano Freitas e Helio Ramos, com foco predominante em "KM/L abaixo da meta" — sinal de que o acompanhamento está sendo direcionado corretamente aos motoristas mais distantes da meta, e não apenas aos casos já resolvidos.</div></div>
    </div></div>
  </div>
  {footer(9)}
</div>""")

# ================= PAGINA 7: TRATATIVAS (melhorada, com meta vs real) =================
rows_tratativas_atrasadas = ""
for t in gfd.TRATATIVAS_ATRASADAS:
    delta = t[6]-t[5]
    rows_tratativas_atrasadas += (f"<tr><td style='text-align:left;padding-left:6px;'>{t[0].title()}</td>"
                                   f"<td>{t[1]}</td><td>{t[2]}</td><td>{t[3]}</td>"
                                   f"<td style='color:#dc2626;font-weight:800;'>{t[4]}d</td>"
                                   f"<td>{fmt(t[5],2)}</td><td>{fmt(t[6],2)}</td>"
                                   f"<td style='color:{'#16a34a' if delta>=0 else '#dc2626'};font-weight:700;'>{fmt(delta,2)}</td></tr>")

rows_tratativas_pendentes = ""
for t in gfd.TRATATIVAS_PENDENTES_PRAZO:
    delta = t[6]-t[5]
    rows_tratativas_pendentes += (f"<tr><td style='text-align:left;padding-left:6px;'>{t[0].title()}</td>"
                                   f"<td>{t[1]}</td><td>{t[2]}</td><td>{t[3]}</td>"
                                   f"<td style='color:#0e7c7b;font-weight:800;'>{t[4]}d</td>"
                                   f"<td>{fmt(t[5],2)}</td><td>{fmt(t[6],2)}</td>"
                                   f"<td style='color:{'#16a34a' if delta>=0 else '#dc2626'};font-weight:700;'>{fmt(delta,2)}</td></tr>")

pages.append(f"""<div class="page-break"></div><div class="page">
  {page_header("Página 10 · Tratativas do Agente Diesel", "Fonte: tabela diesel_tratativas (SLA por prioridade)", "Tratativas totais", str(gfd.TRATATIVAS['total']))}
  <div class="grid-3">
    <div class="card"><div class="card-title">Por status</div><div class="card-body">
      <div class="chart-wrap chart-wrap-sm"><img src="v3_donut.png"/></div>
    </div></div>
    <div class="card" style="grid-column: span 2;"><div class="card-title">Resumo</div><div class="card-body">
      <div class="grid-4">
        <div class="metric"><div class="lbl">Total</div><div class="val">{gfd.TRATATIVAS['total']}</div></div>
        <div class="metric"><div class="lbl">Concluídas</div><div class="val" style="color:#16a34a;">{gfd.TRATATIVAS['por_status']['CONCLUIDA']}</div></div>
        <div class="metric"><div class="lbl">Atrasadas (SLA)</div><div class="val" style="color:#dc2626;">{gfd.TRATATIVAS['por_status']['ATRASADA']}</div></div>
        <div class="metric"><div class="lbl">Pendentes no prazo</div><div class="val">{gfd.TRATATIVAS['por_status']['PENDENTE_NO_PRAZO']}</div></div>
      </div>
      <div class="cons-box" style="margin-top:6px;"><div class="cons-title">Considerações</div>
      <div class="cons-text">Das 91 tratativas, 68% foram concluídas dentro do SLA. As 27 atrasadas concentram-se em 07TR/08TR/10TR e prioridade Alta — mutirão de encerramento recomendado nesta semana.</div></div>
    </div></div>
  </div>
  <div class="card"><div class="card-title">Atrasadas — SLA vencido, com KM/L Meta vs Real (top 15 por dias em aberto)</div><div class="card-body">
    <table class="tbl-compact"><thead><tr><th style="text-align:left;padding-left:6px;">Motorista</th><th>Chapa</th><th>Linha</th><th>Prioridade</th><th>Dias</th><th>KM/L Meta</th><th>KM/L Real</th><th>Diferença</th></tr></thead>
    <tbody>{rows_tratativas_atrasadas}</tbody></table>
  </div></div>
  <div class="card" style="margin-top:6px;"><div class="card-title">Pendentes no prazo</div><div class="card-body">
    <table class="tbl-compact"><thead><tr><th style="text-align:left;padding-left:6px;">Motorista</th><th>Chapa</th><th>Linha</th><th>Prioridade</th><th>Dias</th><th>KM/L Meta</th><th>KM/L Real</th><th>Diferença</th></tr></thead>
    <tbody>{rows_tratativas_pendentes}</tbody></table>
  </div></div>
  {footer(10)}
</div>""")

# ================= PAGINA 8: INSTRUTORES APROFUNDADO =================
pages.append(f"""<div class="page-break"></div><div class="page">
  {page_header("Página 11 · Instrutores — Análise Aprofundada", "Base: diesel_acompanhamentos (Supabase INOVE) · recorte Junho/2026 — novos acompanhamentos iniciados no mês + desfechos ocorridos no mês", "Instrutores ativos", str(len(gfd.INSTRUTORES)))}
  <div class="grid-3" style="margin-bottom:6px;">
    <div class="metric"><div class="lbl">Novos acompanhamentos (iniciados em jun)</div><div class="val">{sum(i['novos'] for i in gfd.INSTRUTORES)}</div><div class="aux">Fabiano + Helio · ainda no ciclo de 30 dias</div></div>
    <div class="metric"><div class="lbl">Desfechos em jun — Concluídos (OK)</div><div class="val" style="color:#16a34a;">{sum(i['desf_ok'] for i in gfd.INSTRUTORES)}</div><div class="aux">ciclos encerrados no mês atingindo a meta</div></div>
    <div class="metric"><div class="lbl">Desfechos em jun — viraram ATA</div><div class="val" style="color:#dc2626;">{sum(i['desf_ata'] for i in gfd.INSTRUTORES)}</div><div class="aux">ciclos encerrados no mês sem atingir a meta</div></div>
  </div>
  <div class="grid-2">
    <div class="card"><div class="card-title">Efetividade — % de acompanhados que atingiram a meta</div><div class="card-body">
      <div class="chart-wrap chart-wrap-tall"><img src="v3_instrutores_eficacia.png"/></div>
    </div></div>
    <div class="card"><div class="card-title">Carteira por status</div><div class="card-body">
      <div class="chart-wrap chart-wrap-tall"><img src="v3_instrutores_status.png"/></div>
    </div></div>
  </div>
  <div class="cons-box"><div class="cons-title">Leitura analítica</div>
  <div class="cons-text">Em Junho iniciaram-se {sum(i['novos'] for i in gfd.INSTRUTORES)} novos acompanhamentos (Fabiano {gfd.INSTRUTORES[0]['novos']}, Helio {gfd.INSTRUTORES[1]['novos']}), quase todos ainda dentro do ciclo de 30 dias — por isso aparecem majoritariamente como "em monitoramento". Já os ciclos que se encerraram no mês somaram {sum(i['desf_ok'] for i in gfd.INSTRUTORES)} concluídos na meta (OK) e {sum(i['desf_ata'] for i in gfd.INSTRUTORES)} que viraram ATA. A efetividade (leitura inicial já na meta) é parecida entre os dois — {fmt(gfd.INSTRUTORES[0]['taxa_atingiu_meta'],1)}% (Fabiano) e {fmt(gfd.INSTRUTORES[1]['taxa_atingiu_meta'],1)}% (Helio) — sinal de que o gargalo é o modelo de acompanhamento, não o instrutor: vale testar ciclos mais curtos com reforço em campo nos primeiros 10 dias.</div></div>
  {footer(11)}
</div>""")

# ================= PAGINA 10b: INSTRUTORES - APROVEITAMENTO DO DIA (ultima semana) =================
rows_inst_diario = ""
for d in gfd.INSTRUTORES_DIA_A_DIA:
    data_, inst, n, thoras, tmed = d
    rows_inst_diario += (f"<tr><td>{data_}</td><td style='text-align:left;padding-left:6px;'>{inst}</td>"
                          f"<td>{n}</td><td>{thoras}</td><td>{tmed} min</td></tr>")

pages.append(f"""<div class="page-break"></div><div class="page">
  {page_header("Página 12 · Instrutores — Aproveitamento do Dia (última semana)", f"Base: diesel_acompanhamento_sessoes — período de {SEM}", "Instrutores ativos", str(len(gfd.INSTRUTORES)))}
  <div class="grid-2">
    <div class="card"><div class="card-title">Aproveitamento do dia — % da jornada (8h) ocupada</div><div class="card-body">
      <div class="chart-wrap chart-wrap-tall"><img src="v3_instrutores_diario.png"/></div>
    </div></div>
    <div class="card"><div class="card-title">Detalhamento diário — período de {SEM}</div><div class="card-body">
      <table class="tbl-big"><thead><tr><th>Data</th><th style="text-align:left;">Instrutor</th><th>Acompanhamentos</th><th>Tempo Total</th><th>Tempo Médio</th></tr></thead>
      <tbody>{rows_inst_diario}</tbody></table>
      <div class="cons-box"><div class="cons-title">Leitura</div>
      <div class="cons-text">A semana teve 5 dias de acompanhamento em campo (29/06 a 03/07), com sessões concentradas em torno de 32-34 minutos e volume estável de 9-10 acompanhamentos por dia entre os dois instrutores.</div></div>
    </div></div>
  </div>
  <div class="cons-box"><div class="cons-title">Leitura analítica</div>
  <div class="cons-text">Nesta semana, ambos os instrutores ocuparam cerca de 2/3 da jornada de 8h com acompanhamentos (~65%), com sessões de 32-34 minutos em média — tempo consistente e não parece ser o gargalo. O 1/3 restante do dia (~2h40) provavelmente é deslocamento entre linhas/veículos e espera; se isso puder ser reduzido, cada instrutor teria margem para mais 3-4 acompanhamentos por dia sem aumentar a carga horária.</div></div>
  {footer(12)}
</div>""")

# ================= PAGINA 9: EVOLUCAO INDIVIDUAL + 30 DIAS =================
rows_acomp = ""
for a in gfd.ACOMPANHAMENTO:
    delta = a["depois"] - a["antes"]
    cor = "#16a34a" if delta >= 0 else "#dc2626"
    seta = "&#8593;" if delta >= 0 else "&#8595;"
    rows_acomp += (f"<tr><td style='text-align:left;padding-left:6px;'>{a['nome']}</td>"
                   f"<td>{a['instrutor']}</td><td>{a['status']}</td>"
                   f"<td>{fmt(a['antes'],3)}</td><td style='font-weight:700;'>{fmt(a['depois'],3)}</td>"
                   f"<td style='color:{cor};font-weight:800;'>{seta} {fmt(abs(delta),3)}</td></tr>")

rows_30dias = ""
for m in gfd.COMPLETARAM_30_DIAS:
    delta = m[5]-m[4]
    cor = "#16a34a" if delta >= 0 else "#dc2626"
    seta = "&#8593;" if delta >= 0 else "&#8595;"
    rows_30dias += (f"<tr><td style='text-align:left;padding-left:6px;'>{m[0].title()}</td><td>{m[1]}</td>"
                     f"<td>{m[2]}</td><td>{m[3]}</td><td>{fmt(m[4],3)}</td><td style='font-weight:700;'>{fmt(m[5],3)}</td>"
                     f"<td style='color:{cor};font-weight:800;'>{seta} {fmt(abs(delta),3)}</td></tr>")

pages.append(f"""<div class="page-break"></div><div class="page">
  {page_header("Página 13 · Evolução Individual e Fechamento de Ciclo (30 dias)", "Base: diesel_acompanhamentos + diesel_acompanhamento_sessoes", "Motoristas c/ 30 dias", str(len(gfd.COMPLETARAM_30_DIAS)))}
  <div class="grid-2">
    <div class="card"><div class="card-title">Antes x Depois — Top 10 mais distantes da meta (novo formato)</div><div class="card-body">
      <div class="chart-wrap chart-wrap-sm"><img src="v3_antes_depois.png"/></div>
    </div></div>
    <div class="card"><div class="card-title">Completaram 30 dias de acompanhamento nesta semana</div><div class="card-body">
      <table class="tbl-big"><thead><tr><th style="text-align:left;padding-left:10px;">Motorista</th><th>Chapa</th><th>Instrutor</th><th>Início</th><th>Meta</th><th>Real</th><th>Evolução</th></tr></thead>
      <tbody>{rows_30dias.replace("padding-left:6px", "padding-left:10px")}</tbody></table>
      <div class="cons-box" style="margin-top:8px;"><div class="cons-title">Leitura</div>
      <div class="cons-text">Ricardo de Oliveira fechou o ciclo acima da meta (+0,131). Os outros 3 seguem abaixo da meta ao final dos 30 dias — candidatos naturais a nova tratativa em vez de simples encerramento do acompanhamento.</div></div>
    </div></div>
  </div>
  <div class="card"><div class="card-title">Detalhe: os 10 mais distantes da meta — teve tratativa? quem acompanhou? resultado?</div><div class="card-body">
    <table style="font-size:9.5px;"><thead><tr style="font-size:8.4px;"><th style="text-align:left;padding-left:10px;">Motorista</th><th>Instrutor</th><th>Status</th><th>KM/L Antes</th><th>KM/L Depois</th><th>Evolução</th></tr></thead>
    <tbody>{rows_acomp.replace("<td", "<td style='padding:5px 6px;'").replace("padding-left:6px", "padding-left:10px")}</tbody></table>
  </div></div>
  {footer(13)}
</div>""")

# ================= PAGINA 13b: O CARRO INTERFERE NO KM/L DENTRO DOS 30 DIAS? =================
nomes_30dias = {m[1]: m[0] for m in gfd.COMPLETARAM_30_DIAS}
rows_veiculo_30d = ""
for v in gfd.VEICULO_30_DIAS:
    chapa, total_dias, carro, vezes, pctc, kml_c, kml_o, n_o = v
    nome = nomes_30dias.get(chapa, chapa).title()
    diff = kml_c - kml_o
    cor = "#16a34a" if diff >= 0 else "#dc2626"
    interfere = "Sim — carro ajuda" if diff > 0.05 else ("Sim — carro atrapalha" if diff < -0.05 else "Pouca diferença")
    rows_veiculo_30d += (f"<tr><td style='text-align:left;padding-left:6px;'>{nome}</td>"
                         f"<td>{carro}</td><td>{vezes}/{total_dias} dias ({fmt(pctc,1)}%)</td>"
                         f"<td style='font-weight:700;'>{fmt(kml_c,3)}</td><td>{fmt(kml_o,3)} (n={n_o})</td>"
                         f"<td style='color:{cor};font-weight:800;'>{fmt(diff,3)}</td>"
                         f"<td style='text-align:left;font-size:7.6px;'>{interfere}</td></tr>")

pages.append(f"""<div class="page-break"></div><div class="page">
  {page_header("Página 14 · O Veículo Interfere no KM/L Durante os 30 Dias?", "Fonte: premiacao_diaria_atualizada — carro mais usado por cada motorista no ciclo de 30 dias", "Motoristas analisados", str(len(gfd.VEICULO_30_DIAS)))}
  <div class="card"><div class="card-title">Metodologia</div><div class="card-body">
    <div class="cons-text" style="font-size:9.5px;">Para cada motorista que completou 30 dias de acompanhamento, identificamos o carro que ele mais dirigiu no período (o "carro principal") e comparamos o KM/L médio nesse carro contra o KM/L médio nos demais carros que ele usou. Isso ajuda a separar o que é comportamento do motorista do que é característica do veículo.</div>
  </div></div>
  <div class="card" style="margin-top:6px;"><div class="card-title">Carro principal x demais carros — KM/L</div><div class="card-body">
    <table class="tbl-big"><thead><tr><th style="text-align:left;padding-left:10px;">Motorista</th><th>Carro Principal</th><th>Uso do Carro Principal</th><th>KM/L no Principal</th><th>KM/L nos Outros</th><th>Diferença</th><th>O carro interfere?</th></tr></thead>
    <tbody>{rows_veiculo_30d.replace("padding-left:6px", "padding-left:10px").replace("font-size:7.6px", "font-size:10px")}</tbody></table>
  </div></div>
  <div class="grid-4" style="margin-top:8px;">
    <div class="cons-box" style="margin-top:0;"><div class="cons-title">Ricardo de Oliveira</div>
    <div class="cons-text" style="font-size:9.5px;">Carro 242524 rende <b>+0,177 km/L</b> a mais que os outros que usou. Fechou o ciclo acima da meta.</div></div>
    <div class="cons-box" style="margin-top:0;"><div class="cons-title">Eduardo José Silva Chaves</div>
    <div class="cons-text" style="font-size:9.5px;">Carro 222201 rende <b>-0,126 km/L</b> a menos. Fator provavelmente comportamental, não o veículo.</div></div>
    <div class="cons-box" style="margin-top:0;"><div class="cons-title">Marcos dos Santos Caitano</div>
    <div class="cons-text" style="font-size:9.5px;">Maior diferença do grupo: <b>+0,368 km/L</b> no carro 222210. Forte indício de efeito do veículo.</div></div>
    <div class="cons-box" style="margin-top:0;"><div class="cons-title">David Dias Perez</div>
    <div class="cons-text" style="font-size:9.5px;">Carro 222207 rende <b>-0,074 km/L</b> a menos. Diferença pequena, provável fator comportamental.</div></div>
  </div>
  <div class="cons-box"><div class="cons-title">Considerações</div>
  <div class="cons-text">Marcos Dos Santos Caitano mostra a maior diferença: +0,368 km/L no carro que mais usou (222210) frente aos demais — forte indício de que o veículo (não só o motorista) explica parte do resultado. Ricardo De Oliveira também rende mais no seu carro principal (+0,177). Já Eduardo José Silva Chaves e David Dias Perez rendem levemente pior no carro que mais usam, sugerindo que para eles o fator determinante é comportamental, não o veículo. Recomenda-se cruzar esta análise com a manutenção/idade dos veículos 242524 e 222210 para confirmar a hipótese.</div></div>
  {footer(14)}
</div>""")

# ================= PAGINA 10: MERITOCRACIA =================
rows_merito = ""
for m in gfd.MERITOCRACIA_TOP:
    rows_merito += (f"<tr><td style='text-align:left;padding-left:6px;'>{m[0].title()}</td><td>{m[1]}</td>"
                     f"<td style='font-weight:700;color:#0e7c7b;'>R$ {m[2]}</td><td>{fmt(m[3],2)}</td></tr>")

pages.append(f"""<div class="page-break"></div><div class="page">
  {page_header("Página 15 · Meritocracia — Premiação por KM/L", "Fonte: BCNT.premiacao_atualizada — valor já calculado pela regra da empresa", "Total pago (Junho)", f"R$ {gfd.MERITOCRACIA_RESUMO['total_pago']:,}".replace(",","."))}
  <div class="grid-2">
    <div class="card"><div class="card-title">Distribuição de valores</div><div class="card-body">
      <div class="chart-wrap chart-wrap-sm"><img src="v3_meritocracia.png"/></div>
    </div></div>
    <div class="card"><div class="card-title">Resumo</div><div class="card-body">
      <div class="grid-2">
        <div class="metric"><div class="lbl">Motoristas premiados</div><div class="val">{gfd.MERITOCRACIA_RESUMO['motoristas_premiados']}</div><div class="aux">de {gfd.MERITOCRACIA_RESUMO['total_motoristas']} elegíveis</div></div>
        <div class="metric"><div class="lbl">Total pago no mês</div><div class="val">R$ {f"{gfd.MERITOCRACIA_RESUMO['total_pago']:,}".replace(",",".")}</div></div>
      </div>
      <div class="metric" style="margin-top:8px;"><div class="lbl">Taxa de premiação</div><div class="val">{fmt(100*gfd.MERITOCRACIA_RESUMO['motoristas_premiados']/gfd.MERITOCRACIA_RESUMO['total_motoristas'],1)}%</div><div class="aux">dos motoristas elegíveis receberam algum valor</div></div>
      <div class="cons-box"><div class="cons-title">Leitura</div>
      <div class="cons-text">Quase 68% dos motoristas elegíveis ({gfd.MERITOCRACIA_RESUMO['distribuicao']['R$ 0']} de {gfd.MERITOCRACIA_RESUMO['total_motoristas']}) não receberam nenhum valor no mês — a régua de premiação está concentrada nas faixas de R$ 100 e R$ 150, o que sugere espaço para uma faixa intermediária que incentive quem está perto de bater a meta, mas ainda não bate.</div></div>
    </div></div>
  </div>
  <div class="card"><div class="card-title">Top 10 maiores premiações (Junho/2026)</div><div class="card-body" style="padding:6px 10px;">
    <table><thead><tr><th style="text-align:left;padding-left:10px;padding-top:4px;padding-bottom:4px;font-size:9px;">Motorista</th><th style="padding-top:4px;padding-bottom:4px;font-size:9px;">Chapa</th><th style="padding-top:4px;padding-bottom:4px;font-size:9px;">Valor</th><th style="padding-top:4px;padding-bottom:4px;font-size:9px;">KM/L</th></tr></thead>
    <tbody>{rows_merito.replace("padding-left:6px", "padding-left:10px").replace("<td", "<td style='padding-top:4px;padding-bottom:4px;font-size:10.5px;'")}</tbody></table>
  </div></div>
  {footer(15)}
</div>""")

# ================= PAGINA 11: DIVERGENCIA TELEMETRIA X TRANSNET =================
rows_diverg = ""
for d in sorted(gfd.DIVERGENCIA_CARROS, key=lambda x: -abs(x[3])):
    rows_diverg += (f"<tr><td style='font-weight:bold;text-align:left;padding-left:6px;'>{d[0]}</td>"
                     f"<td>{fmt(d[1],3)}</td><td>{fmt(d[2],3)}</td>"
                     f"<td style='font-weight:800;color:{'#dc2626' if d[3]<0 else '#e0a800'};'>{pct(d[3])}</td>"
                     f"<td>{d[4]} km</td></tr>")

pages.append(f"""<div class="page-break"></div><div class="page">
  {page_header("Página 16 · Divergência Telemetria x Transnet por Carro (≥10%)", "Fonte: CSV Athena (indicadores_carro_quatai) — Maio a Julho/2026", "Carros com divergência ≥10%", str(len(gfd.DIVERGENCIA_CARROS)))}
  <div class="grid-2">
    <div class="card"><div class="card-title">Divergências ≥10% (mín. 500km no período)</div><div class="card-body">
      <div class="chart-wrap chart-wrap-tall"><img src="v3_divergencia.png"/></div>
    </div></div>
    <div class="card"><div class="card-title">Detalhamento</div><div class="card-body">
      <table class="tbl-big"><thead><tr><th style="text-align:left;padding-left:10px;">Carro</th><th>KM/L Transnet</th><th>KM/L Telemetria</th><th>Diferença</th><th>Km no período</th></tr></thead>
      <tbody>{rows_diverg.replace("padding-left:6px", "padding-left:10px")}</tbody></table>
      <div class="cons-box" style="margin-top:8px;"><div class="cons-title">Considerações</div>
      <div class="cons-text">Ao abrir o corte para ≥10%, nenhum carro novo aparece — a base é bimodal: ou a divergência é enorme (>25%, os 6 carros acima) ou é pequena (abaixo de 10%). Isso reforça que os 6 casos acima não são apenas estilo de condução, e sim fortes candidatos a problema de calibração de sensor ou telemetria com falha de leitura. Recomenda-se checagem física nesses veículos antes de usar o dado de Telemetria para decisões individuais sobre eles.</div></div>
    </div></div>
  </div>
  {footer(16)}
</div>""")

# ================= PAGINA ADERENCIA — REMOVIDA POR ENQUANTO (regra em revisao) =================
# A pagina de Aderencia da Frota foi tirada temporariamente enquanto revisamos a regra
# (dias sem dado / frota / fins de semana). Reintroduzir depois de acertar a metodologia.

# [COWORK] PAGINA NOTURNA (17) — dados MANUAIS: ultima visita, descricao, proxima visita e FOTOS.
# Peca ao usuario e atualize aqui + embuta as fotos anexadas. Ver COWORK_FLASH.md.
# ================= PAGINA 17: ACOMPANHAMENTO NOTURNO =================
pages.append(f"""<div class="page-break"></div><div class="page">
  {page_header("Página 17 · Acompanhamento Noturno", "Visitas de acompanhamento presencial no período noturno — garagem", "Próxima visita", "17/07")}
  <div class="grid-2">
    <div class="card"><div class="card-title">Calendário de visitas — Julho/2026</div><div class="card-body">
      <div style="display:grid;grid-template-columns:repeat(7,1fr);gap:4px;margin-bottom:2px;">{CAL_JULHO_HEADER}</div>
      <div style="display:grid;grid-template-columns:repeat(7,1fr);gap:4px;">{CAL_JULHO_CELLS}</div>
      <div class="cons-box" style="margin-top:8px;"><div class="cons-title">Programação</div>
      <div class="cons-text">Três visitas noturnas programadas para julho — 06/07, 17/07 e 31/07 — mantendo a cadência mensal iniciada em junho. Cada visita inclui verificação de manobras no pátio, orientação aos motoristas em campo e reforço das boas práticas de condução econômica.</div></div>
    </div></div>
    <div class="card"><div class="card-title">Última visita realizada — 06/07/2026</div><div class="card-body">
      <div style="font-weight:800;font-size:10.5px;color:#0f172a;margin-bottom:4px;">Treinamento Prático com Manobristas — Condução de Ônibus em Via Pública</div>
      <div class="cons-text" style="text-align:justify;">Foi realizado treinamento prático com os manobristas, analisando a condução de ônibus em via pública. A atividade teve como objetivo avaliar o desempenho individual dos colaboradores, com foco em segurança operacional, atenção ao trânsito, controle do veículo e postura profissional. No quadro atual contamos com 7 manobristas; foram realizados 5 acompanhamentos nesta visita — 1 colaborador estava de atestado médico e outro em licença-paternidade. O treinamento transcorreu de forma satisfatória, contribuindo significativamente para o aprimoramento técnico da equipe e para a preparação dos colaboradores frente às demandas operacionais.</div>
      <div style="margin-top:8px;border-radius:10px;overflow:hidden;border:1px solid #dbe3ee;"><img src="noturno1.jpg" style="width:100%;height:auto;display:block;"/></div>
      <div class="metric" style="margin-top:8px;"><div class="lbl">Próxima visita programada</div><div class="val" style="font-size:13px;">17/07/2026</div></div>
    </div></div>
  </div>
  {footer(17)}
</div>""")

# [COWORK] CRONOGRAMA (18) — dado MANUAL: regenere este HTML com as semanas/itens do mes que o
# usuario informar (mesmo estilo de cards). Ver COWORK_FLASH.md.
# ================= PAGINA 18: PROGRAMACAO DA SEMANA =================
cronograma_html = """<div class="card" style="margin-bottom:7px;"><div class="card-title">1ª Semana — Julho/2026 <span style="font-weight:400;opacity:.85;">(01 a 03/07)</span></div><div class="card-body" style="padding:6px 10px;"><div style="display:flex;justify-content:space-between;align-items:flex-start;padding:4px 0;border-bottom:1px solid #eef2f7;"><div style="flex:1;"><span style="color:#16a34a;font-weight:800;margin-right:4px;">&#10003;</span><span style="font-size:8.6px;font-weight:700;color:#0f172a;">Imagem Informativa</span><div style="font-size:7.6px;color:#475569;margin-top:1px;">Tamo no Zap: a ferramenta que facilita o seu dia a dia!</div></div><div style="font-size:8px;color:#64748b;font-weight:700;white-space:nowrap;margin-left:6px;">01/07</div></div><div style="display:flex;justify-content:space-between;align-items:flex-start;padding:4px 0;border-bottom:1px solid #eef2f7;"><div style="flex:1;"><span style="color:#16a34a;font-weight:800;margin-right:4px;">&#10003;</span><span style="font-size:8.6px;font-weight:700;color:#0f172a;">Podcast - Fala, Motô!</span><div style="font-size:7.6px;color:#475569;margin-top:1px;">Fugindo de Reclamações e Tratativas: a importância do bom atendimento</div></div><div style="font-size:8px;color:#64748b;font-weight:700;white-space:nowrap;margin-left:6px;">02/07</div></div><div style="display:flex;justify-content:space-between;align-items:flex-start;padding:4px 0;border-bottom:1px solid #eef2f7;"><div style="flex:1;"><span style="color:#16a34a;font-weight:800;margin-right:4px;">&#10003;</span><span style="font-size:8.6px;font-weight:700;color:#0f172a;">Enquete de Fixação</span><div style="font-size:7.6px;color:#475569;margin-top:1px;">Tamo no Zap: a ferramenta que facilita o seu dia a dia!</div></div><div style="font-size:8px;color:#64748b;font-weight:700;white-space:nowrap;margin-left:6px;">03/07</div></div></div></div><div class="card" style="margin-bottom:7px;"><div class="card-title">2ª Semana — Julho/2026 <span style="font-weight:400;opacity:.85;">(06 a 10/07)</span></div><div class="card-body" style="padding:6px 10px;"><div style="display:flex;justify-content:space-between;align-items:flex-start;padding:4px 0;border-bottom:1px solid #eef2f7;"><div style="flex:1;"><span style="color:#16a34a;font-weight:800;margin-right:4px;">&#10003;</span><span style="font-size:8.6px;font-weight:700;color:#0f172a;">Imagem Motivacional</span></div><div style="font-size:8px;color:#64748b;font-weight:700;white-space:nowrap;margin-left:6px;">06/07</div></div><div style="display:flex;justify-content:space-between;align-items:flex-start;padding:4px 0;border-bottom:1px solid #eef2f7;"><div style="flex:1;"><span style="color:#16a34a;font-weight:800;margin-right:4px;">&#10003;</span><span style="font-size:8.6px;font-weight:700;color:#0f172a;">Vídeo - Min. do Conhecimento</span><div style="font-size:7.6px;color:#475569;margin-top:1px;">Lei nº 3.888/2025 – Programa Parada Legal</div></div><div style="font-size:8px;color:#64748b;font-weight:700;white-space:nowrap;margin-left:6px;">07/07</div></div><div style="display:flex;justify-content:space-between;align-items:flex-start;padding:4px 0;border-bottom:1px solid #eef2f7;"><div style="flex:1;"><span style="color:#16a34a;font-weight:800;margin-right:4px;">&#10003;</span><span style="font-size:8.6px;font-weight:700;color:#0f172a;">Imagem Informativa</span><div style="font-size:7.6px;color:#475569;margin-top:1px;">Lei nº 3.888/2025 – Programa Parada Legal</div></div><div style="font-size:8px;color:#64748b;font-weight:700;white-space:nowrap;margin-left:6px;">08/07</div></div><div style="display:flex;justify-content:space-between;align-items:flex-start;padding:4px 0;border-bottom:1px solid #eef2f7;"><div style="flex:1;"><span style="color:#16a34a;font-weight:800;margin-right:4px;">&#10003;</span><span style="font-size:8.6px;font-weight:700;color:#0f172a;">Podcast - Fala, Motô!</span><div style="font-size:7.6px;color:#475569;margin-top:1px;">O Motorista que Conquista Pessoas</div></div><div style="font-size:8px;color:#64748b;font-weight:700;white-space:nowrap;margin-left:6px;">09/07</div></div><div style="display:flex;justify-content:space-between;align-items:flex-start;padding:4px 0;border-bottom:1px solid #eef2f7;"><div style="flex:1;"><span style="color:#16a34a;font-weight:800;margin-right:4px;">&#10003;</span><span style="font-size:8.6px;font-weight:700;color:#0f172a;">Enquete de Fixação</span><div style="font-size:7.6px;color:#475569;margin-top:1px;">Lei nº 3.888/2025 – Programa Parada Legal</div></div><div style="font-size:8px;color:#64748b;font-weight:700;white-space:nowrap;margin-left:6px;">10/07</div></div></div></div>"""
_crono_marker = '<div class="card" style="margin-bottom:7px;">'
_crono_parts = cronograma_html.split(_crono_marker)[1:]
_crono_cards = [_crono_marker + part for part in _crono_parts]
_crono_left = "".join(_crono_cards[:1])
_crono_right = "".join(_crono_cards[1:])
pages.append(f"""<div class="page-break"></div><div class="page">
  {page_header("Página 18 · Programação Educativa — Conteúdo Motorista/Motô", "Cronograma de comunicação e engajamento, semana a semana — Julho/2026", "Semanas executadas", "2/2")}
  <div class="grid-2" style="align-items:start;">
    <div>{_crono_left}</div>
    <div>{_crono_right}
      <div class="cons-box"><div class="cons-title">Sobre o cronograma</div>
      <div class="cons-text">Programação semanal de comunicação e engajamento com os motoristas, combinando imagem motivacional, vídeo de conhecimento, imagem informativa, podcast e enquete de fixação. As duas primeiras semanas de julho foram executadas conforme planejado, com destaque para a série sobre a Lei nº 3.888/2025 — Programa Parada Legal.</div></div>
    </div>
  </div>
  {footer(18)}
</div>""")

# ================= PAGINA 14: MELHORIA CONTINUA =================
sug_acomp_rows = "".join(
    f"""<div class="card" style="margin-bottom:6px;"><div class="card-body" style="padding:7px 10px;">
    <div style="font-weight:800;font-size:9.5px;color:#0f172a;">{s[0]}</div>
    <div style="font-size:8.6px;color:#475569;margin-top:2px;">{s[1]}</div>
    <div style="font-size:8.8px;color:#0e7c7b;font-weight:700;margin-top:3px;">→ {s[2]}</div>
  </div></div>"""
    for s in gfd.SUGESTOES_ACOMPANHAMENTO
)

rows_sug_linhas = ""
for s in gfd.SUGESTOES_LINHAS:
    rows_sug_linhas += (f"<tr><td style='font-weight:bold;text-align:left;padding-left:6px;'>{s[0]}</td>"
                         f"<td style='text-align:left;font-size:8px;'>{s[1]}</td>"
                         f"<td style='text-align:left;font-size:8px;color:#0e7c7b;font-weight:700;'>{s[2]}</td></tr>")

pages.append(f"""<div class="page-break"></div><div class="page">
  {page_header("Página 19 · Melhoria Contínua — Plano de Ação da Semana", "Síntese analítica sobre tratativas, acompanhamentos, linhas, carros e instrutores", "Foco #1 da semana", "07TR")}
  <div class="grid-3" style="margin-bottom:6px;">
    <div class="metric" style="background:#fef2f2;border-color:#fecaca;"><div class="lbl" style="color:#dc2626;">Ação imediata</div><div class="val" style="font-size:11px;color:#0f172a;">3 tratativas &gt;90 dias em aberto</div><div class="aux">Everaldo, José Carlos, Erisvaldo — prioridade Alta</div></div>
    <div class="metric" style="background:#fffbeb;border-color:#fde68a;"><div class="lbl" style="color:#b45309;">Investigar</div><div class="val" style="font-size:11px;color:#0f172a;">Carro 222215 — sensor?</div><div class="aux">+39,5% de divergência Telemetria x Transnet</div></div>
    <div class="metric" style="background:#f0fdf4;border-color:#bbf7d0;"><div class="lbl" style="color:#15803d;">Replicar</div><div class="val" style="font-size:11px;color:#0f172a;">Carro 222210 rende +0,37 km/L</div><div class="aux">Vale testar em outros motoristas da mesma linha</div></div>
  </div>
  <div class="grid-2">
    <div class="card"><div class="card-title">Motoristas — sugestão de novo acompanhamento ou tratativa</div><div class="card-body" style="max-height:105mm;overflow:hidden;">
      {sug_acomp_rows}
    </div></div>
    <div class="card"><div class="card-title">Linhas — sugestão de priorização</div><div class="card-body">
      <table class="tbl-compact"><thead><tr><th style="text-align:left;padding-left:6px;">Linha</th><th>Diagnóstico</th><th>Sugestão</th></tr></thead>
      <tbody>{rows_sug_linhas}</tbody></table>
    </div></div>
  </div>
  <div class="grid-2">
    <div class="cons-box" style="margin-top:0;"><div class="cons-title">Instrutores — ponto de atenção</div>
    <div class="cons-text">Fabiano e Helio convertem menos de 1 em 4 acompanhamentos em meta batida, mesmo ocupando ~65% da jornada. Sugestão: nas próximas 2 semanas, testar ciclos de acompanhamento mais curtos (10 dias) com reforço presencial logo no início, focando nos motoristas que já usam o carro/linha "certos" (ex: 222210, 242524) para isolar se o problema é comportamental.</div></div>
    <div class="cons-box" style="margin-top:0;"><div class="cons-title">Como este plano foi montado</div>
    <div class="cons-text">Cruzamento entre: (1) motoristas do Sinal de Alerta já acompanhados que pioraram; (2) tratativas atrasadas por linha/prioridade; (3) linhas com maior desvio da meta e menor velocidade; (4) carros com divergência de sensor ou efeito positivo/negativo sobre o KM/L nos 30 dias. O objetivo é indicar onde focar na próxima semana, não substituir a análise de campo.</div></div>
  </div>
  {footer(19)}
</div>""")

html = f"""<!DOCTYPE html><html lang="pt-BR"><head><meta charset="UTF-8"/><title>Flash Report Diesel v3</title>
<style>{CSS}</style></head><body>
{''.join(pages)}
</body></html>"""

(OUT / "flash_report_diesel_v3.html").write_text(html, encoding="utf-8")
print("HTML v3 gerado.")
