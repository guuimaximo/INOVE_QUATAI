# Monta o HTML (paginas, A4 paisagem) do Flash Report Diesel v3 e converte pra PDF.
from pathlib import Path
from collections import Counter as _Counter
import importlib.util

OUT = Path(__file__).resolve().parent
spec = importlib.util.spec_from_file_location("gfd3", OUT / "gen_flash_diesel_v3.py")
gfd = importlib.util.module_from_spec(spec)
import sys
sys.modules["gfd3"] = gfd
spec.loader.exec_module(gfd)

fmt = gfd.fmt
pct = gfd.pct
SEM = gfd.SEMANA_ATUAL_LABEL   # janela das Pags 9 e 12: dia 01 ate ontem
# Sem getattr com default: os defaults eram literais de maio/junho e, se um dia o modulo
# deixasse de expor uma dessas variaveis, o relatorio inteiro sairia com o mes errado em
# silencio. Todas sao derivadas de data e sempre existem - se faltar, e para quebrar.
MESREF = gfd.MES_REF_LABEL          # ex.: "Julho/2026"
MESANT = gfd.MES_ANT_LABEL          # ex.: "Junho/2026"
MESREF_NOME, MESANT_NOME = gfd.MES_REF_NOME, gfd.MES_ANT_NOME
PERIODO = gfd.PERIODO_LABEL
_M3 = gfd._MES3
MES3REF, MES3ANT = gfd.MES3_REF, gfd.MES3_ANT

TOTAL_PAGINAS = 19

# Faixa vermelha na capa quando algum bloco caiu no fallback fixo (mes errado silencioso).
_aviso = getattr(gfd, "AVISO_FALLBACK", "")
AVISO_HTML = (f"""<div style="margin-top:16px; max-width:640px; font-size:12px; font-weight:800;
  background:#7f1d1d; border:2px solid #fca5a5; color:#fff; padding:10px 20px; border-radius:10px;">
  &#9888; {_aviso}</div>""" if _aviso else "")

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
_weeks_jul = _cal_c.monthdayscalendar(gfd.MES_REF_ANO, gfd.MES_REF_MM)
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
_visitas_datas = ", ".join(f"{d:02d}/{gfd.MES_REF_MM:02d}" for d in sorted(_visita_label))
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
  {AVISO_HTML}
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
# Sem default para o ultimo valor do dict: em agosto a chave "ago" nao existia e o tile
# exibia o numero de julho rotulado como agosto, sem nenhuma marca de que era de outro mes.
_telem_val = gfd.KML_MENSAL_TELEMETRIA.get(_telem_key)
_telem_txt = fmt(_telem_val, 3) if _telem_val else "n/d"
pages.append(f"""<div class="page-break"></div><div class="page">
  {page_header("Página 2 · KM/L Mensal — Histórico 7 Meses (Transnet oficial)", f"Período: <b>{periodo_label}</b>", "Mês de referência", MESREF)}
  <div class="grid-2">
    <div class="card"><div class="card-title">Evolução Mensal — Transnet</div><div class="card-body">
      <div class="chart-wrap"><img src="v3_historico.png"/></div>
    </div></div>
    <div class="card"><div class="card-title">Resumo Executivo</div><div class="card-body">
      <div class="grid-2">
        <div class="metric"><div class="lbl">KM/L {MESREF_NOME} (Transnet)<span class="badge-oficial">OFICIAL</span></div><div class="val">{fmt(gfd.KML_HISTORICO[-1][1],3)}</div><div class="aux">vs {fmt(gfd.KML_HISTORICO[-2][1],3)} em {MESANT_NOME.lower()} ({pct(var_jun)})</div></div>
        <div class="metric"><div class="lbl">KM/L {MESREF_NOME} (Telemetria)</div><div class="val">{_telem_txt}</div><div class="aux">{"Fonte de comparação" if _telem_val else "sem leitura de telemetria no mês"}</div></div>
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

# As duas leituras abaixo eram texto fixo ("C6 ... 2,37-2,40", "C9 e C11 ... +0,61% e +0,09%")
# ao lado de uma tabela que recalcula esses mesmos numeros toda semana. Agora saem dos dados.
# CLUSTER_TRANSNET: (cluster, kml_mes_anterior, kml_mes_ref).
_cl = list(gfd.CLUSTER_TRANSNET)
_cl_var = {c[0]: ((c[2] - c[1]) / c[1] * 100 if c[1] else 0) for c in _cl}
_cl_pior = min(_cl, key=lambda c: c[2])
_cl_hist_pior = gfd.CLUSTER_HISTORICO_4M.get(_cl_pior[0], [])
_cl_faixa = (f"{fmt(min(m[1] for m in _cl_hist_pior),2)}–{fmt(max(m[1] for m in _cl_hist_pior),2)}"
             if _cl_hist_pior else fmt(_cl_pior[2], 2))
_cl_sobe = [c[0] for c in _cl if _cl_var[c[0]] > 0]
_cl_abaixo = [c[0] for c in _cl if c[2] < gfd.META]
_cl_bate = [c for c in _cl if c[2] >= gfd.META]
_cl_perto = sorted(_cl, key=lambda c: abs(c[2] - gfd.META))[:2]
# Os "mais distantes" excluem os que ja foram citados como mais proximos, para a frase nao
# listar o mesmo cluster nos dois lados quando a frota inteira esta abaixo da meta.
_cl_longe = [c[0] for c in sorted(_cl, key=lambda c: c[2])[:2] if c[0] not in {p[0] for p in _cl_perto}]

_txt_cl_pior = (f"{_cl_pior[0]} é o cluster com pior KM/L do período ({fmt(_cl_pior[2],3)}), "
                f"variando entre {_cl_faixa} nos últimos {len(_cl_hist_pior) or 1} meses, "
                f"abaixo da meta de {fmt(gfd.META,2)} — padrão estrutural do cluster "
                f"(veículo/linha), não evento pontual.")
if _cl_sobe:
    _txt_cl_bom = (f"{', '.join(_cl_sobe)} {'são os' if len(_cl_sobe)>1 else 'é o'} "
                   f"{'únicos' if len(_cl_sobe)>1 else 'único'} com evolução positiva no mês "
                   f"({', '.join(pct(_cl_var[c]) for c in _cl_sobe)}). ")
else:
    _txt_cl_bom = "Nenhum cluster evoluiu positivamente no mês. "
_txt_cl_bom += f"Mais próximos da meta: {', '.join(f'{c[0]} ({fmt(c[2],3)})' for c in _cl_perto)}"
if not _cl_bate:
    _txt_cl_bom += (f" — mas nenhum dos {len(_cl)} clusters atingiu {fmt(gfd.META,2)}"
                    + (f"; {' e '.join(_cl_longe)} seguem os mais distantes." if _cl_longe else "."))
elif _cl_abaixo:
    _txt_cl_bom += f"; {', '.join(_cl_abaixo)} seguem abaixo dela."
else:
    _txt_cl_bom += " — todos os clusters na meta."

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
      <div class="cons-text">{_txt_cl_pior}</div></div>
      <div class="cons-box"><div class="cons-title">Melhor evolução e mais perto da meta</div>
      <div class="cons-text">{_txt_cl_bom}</div></div>
    </div></div>
  </div>
  {footer(3)}
</div>""")

# ================= PAGINA 4: LINHA VS META + VELOCIDADE (formato completo) =================
# (kml_ref_medio foi removido: era calculado e nunca usado, e concorria com kml_ref_pond,
#  que e o valor de fato exibido no tile "KM/L Mes Referencia".)
kml_comp_medio = sum(l[1]*l[6] for l in gfd.LINHA_DESPERDICIO) / sum(l[6] for l in gfd.LINHA_DESPERDICIO)
kml_ref_pond = sum(l[6] for l in gfd.LINHA_DESPERDICIO) / sum(l[7] for l in gfd.LINHA_DESPERDICIO)
var_geral = (kml_ref_pond - kml_comp_medio) / kml_comp_medio * 100
desperdicio_total = sum(l[5] for l in gfd.LINHA_DESPERDICIO)

# Os tres quadros de apoio traziam linhas e valores colados de uma execucao antiga
# (07TR 1.588,97 L etc.), ao lado de uma tabela que se atualiza toda semana. Agora saem
# de LINHA_DESPERDICIO: (linha, kml_ant, kml_ref, var_pct, meta, desperdicio_L, km, litros).
# O quadro "piores linhas" virou "concentracao": repetia as 3 primeiras linhas da tabela
# logo acima, que ja e ordenada por desperdicio.
_ld_ord = sorted(gfd.LINHA_DESPERDICIO, key=lambda l: -l[5])
_ld_top3 = _ld_ord[:3]
_desp_tot = sum(l[5] for l in gfd.LINHA_DESPERDICIO) or 1
_p4_conc = (f"As 3 linhas de maior desperdício somam <b>{fmt(sum(l[5] for l in _ld_top3),0)} L</b>, "
            f"<b>{fmt(100*sum(l[5] for l in _ld_top3)/_desp_tot,0)}%</b> do total de "
            f"{fmt(_desp_tot,0)} L em {len(gfd.LINHA_DESPERDICIO)} linhas.")
_ld_sobe = sorted(gfd.LINHA_DESPERDICIO, key=lambda l: -l[3])[:3]
_ld_cai = sorted(gfd.LINHA_DESPERDICIO, key=lambda l: l[3])[:3]
_p4_melhores = "<br/>".join(f"<b>{l[0]}</b> ({pct(l[3])})" for l in _ld_sobe) or "—"
_p4_pioraram = "<br/>".join(f"<b>{l[0]}</b> ({pct(l[3])})" for l in _ld_cai) or "—"

rows_linha_completa = ""
for l in _ld_ord:
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
  {page_header(f"Página 4 · Análise por Linha — KM/L, Meta e Desperdício ({MES3REF} vs {MES3ANT})", "Fonte: premiacao_diaria_atualizada (Telemetria)", "Linhas monitoradas", str(len(gfd.LINHA_DESPERDICIO)))}
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
    <div class="cons-box" style="margin-top:0;"><div class="cons-title">Concentração do desperdício</div>
    <div class="cons-text" style="font-size:10px;">{_p4_conc}</div></div>
    <div class="cons-box" style="margin-top:0;"><div class="cons-title">Melhores linhas (maior evolução {MES3ANT}→{MES3REF})</div>
    <div class="cons-text" style="font-size:10px;">{_p4_melhores}</div></div>
    <div class="cons-box" style="margin-top:0;"><div class="cons-title">Linhas que mais pioraram</div>
    <div class="cons-text" style="font-size:10px;">{_p4_pioraram}</div></div>
  </div>
  {footer(4)}
</div>""")

# ================= PAGINA 4b: DISTANCIA DA META x VELOCIDADE (grafico que o usuario gostou) =================
# O paragrafo abaixo era escrito a mao e discordava dos dados: citava 07TR entre as mais
# lentas (esta a 18,2 km/h), omitia a 2a e 3a piores, e atribuia 20,3 km/h ao 02TR quando
# 20,3 e do 03TR. Agora sai tudo de gfd.LINHAS. Campos: (linha, km_l, vel_media, meta, km).
_ln_dist = sorted(gfd.LINHAS, key=lambda l: l[1] - l[3])[:4]          # mais distantes da meta
_ln_nomes = ", ".join(l[0] for l in _ln_dist)
_ln_vmin, _ln_vmax = min(l[2] for l in _ln_dist), max(l[2] for l in _ln_dist)
_frota_vmed = sum(l[2] for l in gfd.LINHAS) / len(gfd.LINHAS)
# So afirma a tese de "as mais distantes sao tambem as mais lentas" se ela se sustentar.
_tese_lentas = _ln_vmax < _frota_vmed
_ln_rapidas = sorted(gfd.LINHAS, key=lambda l: -l[2])[:2]
_rap_batem = [l for l in _ln_rapidas if l[1] >= l[3]]
if _tese_lentas:
    _p5_a = (f"As linhas mais distantes da meta ({_ln_nomes}) também estão entre as mais lentas "
             f"({fmt(_ln_vmin,1)}–{fmt(_ln_vmax,1)} km/h, contra média de {fmt(_frota_vmed,1)} km/h "
             f"na frota), reforçando a hipótese de que trânsito/paradas explicam parte do "
             f"desperdício — não apenas condução.")
else:
    _p5_a = (f"As linhas mais distantes da meta ({_ln_nomes}) têm velocidades de "
             f"{fmt(_ln_vmin,1)} a {fmt(_ln_vmax,1)} km/h, ante média de {fmt(_frota_vmed,1)} km/h "
             f"na frota — ou seja, lentidão não explica sozinha o desvio destas linhas.")
if len(_rap_batem) == len(_ln_rapidas):
    _p5_b = (f" As mais rápidas ({', '.join(f'{l[0]} a {fmt(l[2],1)} km/h' for l in _ln_rapidas)}) "
             f"batem ou superam a meta.")
elif _rap_batem:
    _p5_b = (f" Entre as mais rápidas, {', '.join(l[0] for l in _rap_batem)} bate a meta, "
             f"mas {', '.join(l[0] for l in _ln_rapidas if l not in _rap_batem)} não — "
             f"velocidade alta por si só não garante o resultado.")
else:
    _p5_b = (f" Mesmo as mais rápidas ({', '.join(l[0] for l in _ln_rapidas)}) ficam abaixo da "
             f"meta, o que enfraquece a leitura de que o problema seja só trânsito.")
consid_p5 = _p5_a + _p5_b + (" Vale validar com a equipe de tráfego antes de cobrar apenas "
                             "dos motoristas nas linhas mais lentas.")

pages.append(f"""<div class="page-break"></div><div class="page">
  {page_header("Página 5 · Distância da Meta por Linha, com Velocidade Média", f"Fonte: premiacao_diaria_atualizada (Telemetria) — {MESREF}", "Linhas monitoradas", str(len(gfd.LINHAS)))}
  <div class="card"><div class="card-title">Distância da meta por linha, cruzada com velocidade média</div><div class="card-body">
    <div class="chart-wrap"><img src="v3_linha_meta.png"/></div>
  </div></div>
  <div class="cons-box"><div class="cons-title">Considerações</div>
  <div class="cons-text">{consid_p5}</div></div>
  {footer(5)}
</div>""")

# ================= PAGINA 5b: VELOCIDADE MEDIA DIARIA x KM/L (correlacao) =================
# Correlacao dinamica (Pearson) velocidade x KM/L diario — evita texto fixo desatualizado.
_vk = list(gfd.KML_VELOCIDADE_DIARIO)
def _pearson(xs, ys):
    n = len(xs)
    if n < 2:
        return 0.0
    mx = sum(xs) / n; my = sum(ys) / n
    sxy = sum((x - mx) * (y - my) for x, y in zip(xs, ys))
    sxx = sum((x - mx) ** 2 for x in xs); syy = sum((y - my) ** 2 for y in ys)
    if sxx == 0 or syy == 0:
        return 0.0
    return sxy / ((sxx * syy) ** 0.5)
_vels = [d[2] for d in _vk]; _kmls = [d[1] for d in _vk]
_r = _pearson(_vels, _kmls); _absr = abs(_r)
_forca = "forte" if _absr >= 0.7 else ("moderada" if _absr >= 0.4 else ("fraca" if _absr >= 0.2 else "muito fraca"))
_sinal = "positiva" if _r >= 0 else "negativa"
_tend = "maior" if _r >= 0 else "menor"
_vel_med = (sum(_vels) / len(_vels)) if _vels else 0
if not _vk:
    consid_p6 = "Sem dados diários suficientes de velocidade e KM/L nesta janela para avaliar a correlação."
else:
    consid_p6 = (f"Correlação {_forca} e {_sinal} entre velocidade média diária e KM/L (r = {fmt(_r,2)}): "
                 f"os dias com velocidade média mais alta (acima de ~{fmt(_vel_med,0)} km/h, tipicamente com menos trânsito) "
                 f"tendem a apresentar KM/L {_tend}. Isso ajuda a entender por que as linhas urbanas mais lentas ficam distantes da meta"
                 + (", e reforça que trânsito/parada explica parte do desperdício." if _r >= 0.2 else "; ainda assim, o efeito observado nesta janela é pequeno."))
pages.append(f"""<div class="page-break"></div><div class="page">
  {page_header("Página 6 · Velocidade Média Diária x KM/L — Correlação", f"Fonte: premiacao_diaria_atualizada (Telemetria) — {PERIODO}", "Dias analisados", str(len(gfd.KML_VELOCIDADE_DIARIO)))}
  <div class="card"><div class="card-title">KM/L diário x Velocidade média diária</div><div class="card-body">
    <div class="chart-wrap chart-wrap-sm"><img src="v3_vel_kml_diario.png"/></div>
  </div></div>
  <div class="cons-box"><div class="cons-title">Considerações</div>
  <div class="cons-text">{consid_p6}</div></div>
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
  {page_header(f"Página 7 · Top 10 — Maior Distância da Meta ({MESREF_NOME})", f"Período: <b>{periodo_label}</b>", "Mês de referência", MESREF)}
  <div class="grid-2">
    <div class="card"><div class="card-title">Top 10 — Maior distância da meta</div><div class="card-body">
      <div class="chart-wrap chart-wrap-sm"><img src="v3_piores.png"/></div>
    </div></div>
    <div class="card"><div class="card-title">Detalhamento — com último acompanhamento e última tratativa</div><div class="card-body">
      <table class="tbl-big"><thead><tr><th style="text-align:left;padding-left:10px;">Motorista</th><th>Chapa</th><th>KM/L Real</th><th>Meta</th><th>Último Acompanhamento</th><th>Última Tratativa</th></tr></thead>
      <tbody>{rows_piores.replace("padding-left:6px", "padding-left:10px").replace("font-size:7.4px", "font-size:8.6px")}</tbody></table>
      <div class="cons-box"><div class="cons-title">Leitura</div>
      <div class="cons-text">Dos 10 motoristas mais distantes da meta em {MESREF_NOME}, a maioria já está em algum estágio de acompanhamento ou tratativa — o desafio não é falta de ação, mas a velocidade de conversão desses casos em melhoria efetiva de KM/L.</div></div>
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
  {page_header(f"Página 8 · Top 10 Melhores e Sinal de Alerta ({MES3ANT}→{MES3REF})", f"Período: <b>{periodo_label}</b>", "Mês de referência", MESREF)}
  <div class="grid-2">
    <div class="card"><div class="card-title">Top 10 — Melhor desempenho ({MESREF_NOME})</div><div class="card-body">
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

# O texto da carteira citava "Fabiano Freitas e Helio Ramos" e "quase igualmente" como
# literais. MOTORISTAS_SEMANA: (nome, chapa, instrutor, data, foco).
_ms = list(gfd.MOTORISTAS_SEMANA)
_ms_inst = _Counter(m[2] for m in _ms if m[2])
_ms_foco = _Counter(m[4] for m in _ms if m[4])
if len(_ms_inst) >= 2:
    (_i1, _n1), (_i2, _n2) = _ms_inst.most_common(2)
    _equil = "dividida quase igualmente" if abs(_n1 - _n2) <= max(1, 0.2 * len(_ms)) else "concentrada"
    _txt_inst = f"{_equil} entre {_i1} ({_n1}) e {_i2} ({_n2})"
elif _ms_inst:
    _txt_inst = f"concentrada em {_ms_inst.most_common(1)[0][0]}"
else:
    _txt_inst = "sem instrutor identificado"
_txt_carteira = (f"A carteira do período ({len(_ms)} motoristas) está {_txt_inst}"
                 + (f", com foco predominante em \"{_ms_foco.most_common(1)[0][0]}\"" if _ms_foco else "")
                 + " — sinal de que o acompanhamento está sendo direcionado aos motoristas "
                   "mais distantes da meta, e não apenas aos casos já resolvidos.")

rows_semana = ""
for m in _ms:
    rows_semana += (f"<tr><td style='text-align:left;padding-left:6px;'>{m[0].title()}</td><td>{m[1]}</td>"
                     f"<td>{m[2]}</td><td>{m[3]}</td><td style='text-align:left;font-size:7.6px;'>{m[4]}</td></tr>")

pages.append(f"""<div class="page-break"></div><div class="page">
  {page_header("Página 9 · Destaque Positivo e Motoristas em Acompanhamento", f"Período: <b>{periodo_label}</b>", "Mês de referência", MESREF)}
  <div class="grid-2">
    <div class="card"><div class="card-title">Destaque Positivo — maior evolução {MESANT_NOME}→{MESREF_NOME}</div><div class="card-body">
      <div class="chart-wrap chart-wrap-sm"><img src="v3_destaque.png"/></div>
      <table class="tbl-compact" style="margin-top:5px;"><thead><tr><th style="text-align:left;padding-left:6px;">Motorista</th><th>KM/L {MES3ANT}</th><th>KM/L {MES3REF}</th><th>Variação</th></tr></thead>
      <tbody>{rows_destaque}</tbody></table>
    </div></div>
    <div class="card"><div class="card-title">Motoristas em acompanhamento no período ({SEM})</div><div class="card-body">
      <table class="tbl-big"><thead><tr><th style="text-align:left;padding-left:10px;">Motorista</th><th>Chapa</th><th>Instrutor</th><th>Data</th><th style="text-align:left;">Foco</th></tr></thead>
      <tbody>{rows_semana.replace("padding-left:6px", "padding-left:10px")}</tbody></table>
      <div class="cons-box"><div class="cons-title">Leitura do período</div>
      <div class="cons-text">{_txt_carteira}</div></div>
    </div></div>
  </div>
  {footer(9)}
</div>""")

# ================= PAGINA 7: TRATATIVAS (melhorada, com meta vs real) =================
# Este paragrafo era fixo ("Das 91 tratativas, 68% ... As 27 atrasadas ... 07TR/08TR/10TR")
# e batia por acaso com o fallback, entao contradizia os tiles assim que o dado ao vivo
# entrasse. Agora sai de TRATATIVAS / TRATATIVAS_ATRASADAS.
# TRATATIVAS_ATRASADAS: (nome, chapa, linha, prioridade, dias_aberto, kml_meta, kml_real).
_tr_tot = gfd.TRATATIVAS["total"] or 1
_tr_st = gfd.TRATATIVAS["por_status"]
_tr_conc, _tr_atr = _tr_st.get("CONCLUIDA", 0), _tr_st.get("ATRASADA", 0)
_tr_linhas = _Counter(t[2] for t in gfd.TRATATIVAS_ATRASADAS if t[2] and t[2] != "-")
_tr_prio = _Counter(t[3] for t in gfd.TRATATIVAS_ATRASADAS if t[3] and t[3] != "-")
_txt_tratativas = (f"Das {gfd.TRATATIVAS['total']} tratativas, "
                   f"{fmt(100*_tr_conc/_tr_tot,0)}% foram concluídas dentro do SLA.")
if _tr_atr:
    _tr_top = ", ".join(l for l, _ in _tr_linhas.most_common(3))
    _txt_tratativas += (f" As {_tr_atr} atrasadas"
                        + (f" concentram-se em {_tr_top}" if _tr_top else "")
                        + (f" e prioridade {_tr_prio.most_common(1)[0][0]}" if _tr_prio else "")
                        + " — mutirão de encerramento recomendado nesta semana.")
else:
    _txt_tratativas += " Nenhuma tratativa com SLA vencido no período."

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
      <div class="cons-text">{_txt_tratativas}</div></div>
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
# A leitura citava "Fabiano"/"Helio" como literais presos aos indices [0] e [1]: se a ordem
# da lista mudasse (a carga ao vivo nao garante ordem), o numero de um sairia com o nome do
# outro. E repetia em prosa os tres tiles logo acima. Agora os nomes saem dos dados e o
# texto guarda so a interpretacao.
_inst = list(gfd.INSTRUTORES)
_inst_nomes = " + ".join(i["nome"].split()[0] for i in _inst) or "instrutores"
_inst_novos = sum(i["novos"] for i in _inst)
_inst_taxas = [i["taxa_atingiu_meta"] for i in _inst]
_txt_instrutores = (
    f"Dos {_inst_novos} acompanhamentos iniciados em {MESREF_NOME}, a maior parte segue dentro "
    f"do ciclo de 30 dias — por isso aparecem majoritariamente como \"em monitoramento\". "
    + (f"A efetividade (leitura inicial já na meta) fica entre "
       f"{fmt(min(_inst_taxas),1)}% e {fmt(max(_inst_taxas),1)}%"
       + (" — parecida entre os instrutores, " if max(_inst_taxas) - min(_inst_taxas) <= 5
          else " — com diferença relevante entre eles, ")
       + ("sinal de que o gargalo é o modelo de acompanhamento, não o instrutor: vale testar "
          "ciclos mais curtos com reforço em campo nos primeiros 10 dias."
          if max(_inst_taxas) - min(_inst_taxas) <= 5 else
          "o que sugere olhar a abordagem individual antes de mudar o modelo.")
       if _inst_taxas else ""))
pages.append(f"""<div class="page-break"></div><div class="page">
  {page_header("Página 11 · Instrutores — Análise Aprofundada", f"Base: diesel_acompanhamentos (Supabase INOVE) · recorte {MESREF} — novos acompanhamentos iniciados no mês + desfechos ocorridos no mês", "Instrutores ativos", str(len(gfd.INSTRUTORES)))}
  <div class="grid-3" style="margin-bottom:6px;">
    <div class="metric"><div class="lbl">Novos acompanhamentos (iniciados em {MESREF_NOME.lower()})</div><div class="val">{sum(i['novos'] for i in gfd.INSTRUTORES)}</div><div class="aux">{_inst_nomes} · ainda no ciclo de 30 dias</div></div>
    <div class="metric"><div class="lbl">Desfechos em {MESREF_NOME.lower()} — Concluídos (OK)</div><div class="val" style="color:#16a34a;">{sum(i['desf_ok'] for i in gfd.INSTRUTORES)}</div><div class="aux">ciclos encerrados no mês atingindo a meta</div></div>
    <div class="metric"><div class="lbl">Desfechos em {MESREF_NOME.lower()} — viraram ATA</div><div class="val" style="color:#dc2626;">{sum(i['desf_ata'] for i in gfd.INSTRUTORES)}</div><div class="aux">ciclos encerrados no mês sem atingir a meta</div></div>
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
  <div class="cons-text">{_txt_instrutores}</div></div>
  {footer(11)}
</div>""")

# ================= PAGINA 10b: INSTRUTORES - APROVEITAMENTO DO DIA (ultima semana) =================
# Os dois paragrafos traziam "5 dias (29/06 a 03/07)", "32-34 minutos", "9-10 por dia" e
# "~65%" digitados - a janela era literal de junho num relatorio de julho. Tudo derivado
# agora. INSTRUTORES_DIA_A_DIA: (data, instrutor, n_sessoes, tempo_total, tempo_medio_min).
_dad = list(gfd.INSTRUTORES_DIA_A_DIA)
_dia_ct = len({d[0] for d in _dad})
_dia_sess = [d[2] for d in _dad if d[2]]
_dia_min = [d[4] for d in _dad if d[4]]
_idi = list(gfd.INSTRUTORES_DIARIO)
_apr = [i["aproveitamento_dia_pct"] for i in _idi] or [0]
_apr_med = sum(_apr) / len(_apr)
_h_med = (sum(i["media_h_dia"] for i in _idi) / len(_idi)) if _idi else 0
_ocioso_h = max(0.0, 8 - _h_med)


def _faixa(v, d=0):
    """'32-34' quando ha dispersao, '33' quando nao."""
    if not v:
        return "—"
    lo, hi = min(v), max(v)
    return fmt(lo, d) if abs(hi - lo) < (1 if d == 0 else 0.1) else f"{fmt(lo,d)}-{fmt(hi,d)}"


_txt_p12_campo = (f"O período ({SEM}) teve {_dia_ct} "
                  f"{'dia' if _dia_ct == 1 else 'dias'} de acompanhamento em campo, com sessões "
                  f"em torno de {_faixa(_dia_min)} minutos e volume de {_faixa(_dia_sess)} "
                  f"acompanhamentos por dia entre os instrutores.")
_txt_p12_jornada = (
    f"No período, os instrutores ocuparam em média {fmt(_apr_med,0)}% da jornada de 8h com "
    f"acompanhamentos ({fmt(_h_med,1)}h/dia), com sessões de {_faixa(_dia_min)} minutos — tempo "
    f"consistente, que não parece ser o gargalo. O restante do dia (~{fmt(_ocioso_h,1)}h) "
    f"provavelmente é deslocamento entre linhas/veículos e espera; se isso puder ser reduzido, "
    f"cada instrutor teria margem para mais acompanhamentos sem aumentar a carga horária.")
rows_inst_diario = ""
for d in gfd.INSTRUTORES_DIA_A_DIA:
    data_, inst, n, thoras, tmed = d
    rows_inst_diario += (f"<tr><td>{data_}</td><td style='text-align:left;padding-left:6px;'>{inst}</td>"
                          f"<td>{n}</td><td>{thoras}</td><td>{tmed} min</td></tr>")

pages.append(f"""<div class="page-break"></div><div class="page">
  {page_header("Página 12 · Instrutores — Aproveitamento do Dia", f"Base: diesel_acompanhamento_sessoes — período de {SEM}", "Instrutores ativos", str(len(gfd.INSTRUTORES)))}
  <div class="grid-2">
    <div class="card"><div class="card-title">Aproveitamento do dia — % da jornada (8h) ocupada</div><div class="card-body">
      <div class="chart-wrap chart-wrap-tall"><img src="v3_instrutores_diario.png"/></div>
    </div></div>
    <div class="card"><div class="card-title">Detalhamento diário — período de {SEM}</div><div class="card-body">
      <table class="tbl-big"><thead><tr><th>Data</th><th style="text-align:left;">Instrutor</th><th>Acompanhamentos</th><th>Tempo Total</th><th>Tempo Médio</th></tr></thead>
      <tbody>{rows_inst_diario}</tbody></table>
      <div class="cons-box"><div class="cons-title">Leitura</div>
      <div class="cons-text">{_txt_p12_campo}</div></div>
    </div></div>
  </div>
  <div class="cons-box"><div class="cons-title">Leitura analítica</div>
  <div class="cons-text">{_txt_p12_jornada}</div></div>
  {footer(12)}
</div>""")

# ================= PAGINA 9: EVOLUCAO INDIVIDUAL + 30 DIAS =================
rows_acomp = ""
# Ordena aqui tambem (e nao so na origem) para o fallback fixo respeitar a ordem
# que o titulo do card anuncia: da maior queda para a maior evolucao.
for a in sorted(gfd.ACOMPANHAMENTO, key=lambda x: x["depois"] - x["antes"]):
    delta = a["depois"] - a["antes"]
    # Variacao abaixo de 0,01 km/L e ruido de medicao, nao evolucao: sai neutra (=) em
    # cinza, em vez de seta verde para cima. Antes, delta 0,000 caia no >= e virava alta.
    if abs(delta) < 0.01:
        cor, seta = "#94a3b8", "="
    elif delta > 0:
        cor, seta = "#16a34a", "&#8593;"
    else:
        cor, seta = "#dc2626", "&#8595;"
    _kma = f"{a['km_antes']:,}".replace(",", ".") if a.get("km_antes") else "—"
    _kmd = f"{a['km_depois']:,}".replace(",", ".") if a.get("km_depois") else "—"
    rows_acomp += (f"<tr><td style='text-align:left;padding-left:6px;'>{a['nome']}</td>"
                   f"<td>{a['instrutor']}</td><td>{a['status']}</td>"
                   f"<td style='color:#64748b;'>{_kma}</td><td>{fmt(a['antes'],3)}</td>"
                   f"<td style='color:#64748b;'>{_kmd}</td><td style='font-weight:700;'>{fmt(a['depois'],3)}</td>"
                   f"<td style='color:{cor};font-weight:800;'>{seta} {fmt(abs(delta),3)}</td></tr>")

rows_30dias = ""
for m in gfd.COMPLETARAM_30_DIAS:
    delta = m[5]-m[4]
    cor = "#16a34a" if delta >= 0 else "#dc2626"
    seta = "&#8593;" if delta >= 0 else "&#8595;"
    rows_30dias += (f"<tr><td style='text-align:left;padding-left:6px;'>{m[0].title()}</td><td>{m[1]}</td>"
                     f"<td>{m[2]}</td><td>{m[3]}</td><td>{fmt(m[4],3)}</td><td style='font-weight:700;'>{fmt(m[5],3)}</td>"
                     f"<td style='color:{cor};font-weight:800;'>{seta} {fmt(abs(delta),3)}</td></tr>")

# Leitura dinamica do fechamento de 30 dias — evita citar motorista/numero fixo.
_c30 = list(gfd.COMPLETARAM_30_DIAS)
_acima = [m for m in _c30 if (m[5] - m[4]) >= 0]
_abaixo = [m for m in _c30 if (m[5] - m[4]) < 0]
if not _c30:
    leitura_30dias = "Nenhum motorista completou o ciclo de 30 dias de acompanhamento nesta janela."
elif _acima:
    _best = max(_acima, key=lambda m: m[5] - m[4]); _d = _best[5] - _best[4]; _n = len(_abaixo)
    if _n == 0:
        leitura_30dias = f"Todos os {len(_c30)} motoristas fecharam o ciclo na meta ou acima — destaque para {_best[0].title()} (+{fmt(_d,3)}). Bom momento para encerrar os acompanhamentos e migrar o foco para novos casos."
    else:
        _pref = f"Os outros {_n} seguem" if _n > 1 else "O outro segue"
        leitura_30dias = f"{_best[0].title()} fechou o ciclo acima da meta (+{fmt(_d,3)}). {_pref} abaixo da meta ao final dos 30 dias — candidatos naturais a nova tratativa em vez de simples encerramento do acompanhamento."
else:
    leitura_30dias = f"Os {len(_c30)} motoristas que completaram os 30 dias fecharam o ciclo abaixo da meta — candidatos naturais a nova tratativa em vez de simples encerramento do acompanhamento."
pages.append(f"""<div class="page-break"></div><div class="page">
  {page_header("Página 13 · Evolução Individual e Fechamento de Ciclo (30 dias)", "Base: diesel_acompanhamentos + diesel_acompanhamento_sessoes", "Motoristas c/ 30 dias", str(len(gfd.COMPLETARAM_30_DIAS)))}
  <div class="grid-2">
    <div class="card"><div class="card-title">Antes x Depois — motoristas em acompanhamento</div><div class="card-body">
      <div class="chart-wrap chart-wrap-sm"><img src="v3_antes_depois.png"/></div>
    </div></div>
    <div class="card"><div class="card-title">Completaram 30 dias de acompanhamento nesta semana</div><div class="card-body">
      <table class="tbl-big"><thead><tr><th style="text-align:left;padding-left:10px;">Motorista</th><th>Chapa</th><th>Instrutor</th><th>Início</th><th>Meta</th><th>Real</th><th>Evolução</th></tr></thead>
      <tbody>{rows_30dias.replace("padding-left:6px", "padding-left:10px")}</tbody></table>
      <div class="cons-box" style="margin-top:8px;"><div class="cons-title">Leitura</div>
      <div class="cons-text">{leitura_30dias}</div></div>
    </div></div>
  </div>
  <div class="card"><div class="card-title">Detalhe por motorista em acompanhamento — 30 dias antes do início x do início até hoje (ordenado da maior queda para a maior evolução)</div><div class="card-body">
    <table style="font-size:8.4px;"><thead><tr style="font-size:8.4px;"><th style="text-align:left;padding-left:10px;">Motorista</th><th>Instrutor</th><th>Status</th><th>KM Antes</th><th>KM/L Antes</th><th>KM Depois</th><th>KM/L Depois</th><th>Evolução</th></tr></thead>
    <tbody>{rows_acomp.replace("<td", "<td style='padding:2px 6px;'").replace("padding-left:6px", "padding-left:10px")}</tbody></table>
  </div></div>
  {footer(13)}
</div>""")

# ================= PAGINA 13b: O CARRO INTERFERE NO KM/L DENTRO DOS 30 DIAS? =================
nomes_30dias = {m[1]: m[0] for m in gfd.COMPLETARAM_30_DIAS}
def _veic_nome(_ch):
    _nm = nomes_30dias.get(_ch)
    return _nm.title() if _nm else f"Motorista {_ch}"
rows_veiculo_30d = ""
for v in gfd.VEICULO_30_DIAS:
    chapa, total_dias, carro, vezes, pctc, kml_c, kml_o, n_o = v
    nome = _veic_nome(chapa)
    diff = kml_c - kml_o
    cor = "#16a34a" if diff >= 0 else "#dc2626"
    interfere = "Sim — carro ajuda" if diff > 0.05 else ("Sim — carro atrapalha" if diff < -0.05 else "Pouca diferença")
    rows_veiculo_30d += (f"<tr><td style='text-align:left;padding-left:6px;'>{nome}</td>"
                         f"<td>{carro}</td><td>{vezes}/{total_dias} dias ({fmt(pctc,1)}%)</td>"
                         f"<td style='font-weight:700;'>{fmt(kml_c,3)}</td><td>{fmt(kml_o,3)} (n={n_o})</td>"
                         f"<td style='color:{cor};font-weight:800;'>{fmt(diff,3)}</td>"
                         f"<td style='text-align:left;font-size:7.6px;'>{interfere}</td></tr>")

# Caixas e leitura dinamicas dos casos mais marcantes de efeito do veiculo (evita nomes fixos).
_veic = list(gfd.VEICULO_30_DIAS)
_veic_sorted = sorted(_veic, key=lambda v: abs(v[5] - v[6]), reverse=True)[:4]
_boxes_veic = ""
for _v in _veic_sorted:
    _chapa, _td, _carro, _vez, _pctc, _kmlc, _kmlo, _no = _v
    _nome = _veic_nome(_chapa)
    _diff = _kmlc - _kmlo
    if _diff > 0.05:
        _interp = "Forte indício de efeito positivo do veículo."
    elif _diff < -0.05:
        _interp = "Fator provavelmente comportamental, não o veículo."
    else:
        _interp = "Diferença pequena, provável fator comportamental."
    _sin = "a mais" if _diff >= 0 else "a menos"
    _boxes_veic += (f'<div class="cons-box" style="margin-top:0;"><div class="cons-title">{_nome}</div>'
                    f'<div class="cons-text" style="font-size:9.5px;">Carro {_carro} rende <b>{fmt(abs(_diff),3)} km/L</b> {_sin} '
                    f'que os outros que usou. {_interp}</div></div>')
if _veic:
    _vp = max(_veic, key=lambda v: v[5] - v[6]); _vn = min(_veic, key=lambda v: v[5] - v[6])
    _np = _veic_nome(_vp[0]); _dp = _vp[5] - _vp[6]
    _nn = _veic_nome(_vn[0]); _dn = _vn[5] - _vn[6]
    consid_p14 = (f"{_np} mostra a maior diferença positiva: +{fmt(_dp,3)} km/L no carro que mais usou ({_vp[2]}) "
                  f"frente aos demais — indício de que o veículo (não só o motorista) explica parte do resultado. "
                  f"Já {_nn} rende {fmt(abs(_dn),3)} km/L {'a mais' if _dn >= 0 else 'a menos'} no carro principal ({_vn[2]}), "
                  f"o que aponta para fator {'do veículo' if _dn > 0.05 else 'comportamental'}. "
                  f"Recomenda-se cruzar esta análise com a manutenção/idade dos veículos com maior efeito para confirmar a hipótese.")
else:
    consid_p14 = "Nenhum motorista com dados suficientes de carro principal x demais carros nesta janela de 30 dias."
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
    {_boxes_veic}
  </div>
  <div class="cons-box"><div class="cons-title">Considerações</div>
  <div class="cons-text">{consid_p14}</div></div>
  {footer(14)}
</div>""")

# ================= PAGINA 10: MERITOCRACIA =================
# "Quase 68%" era digitado ao lado da propria contagem interpolada, e as faixas "R$ 100 e
# R$ 150" tambem eram literais - divergiriam do dado ao vivo.
_mr = gfd.MERITOCRACIA_RESUMO
_p15_pct = fmt(100 * _mr["distribuicao"].get("R$ 0", 0) / (_mr["total_motoristas"] or 1), 0)
_p15_top = [f for f, n in sorted(((f, n) for f, n in _mr["distribuicao"].items() if f != "R$ 0"),
                                 key=lambda x: -x[1])[:2]]
_p15_faixas = " e ".join(_p15_top) if _p15_top else "—"

rows_merito = ""
for m in gfd.MERITOCRACIA_TOP:
    rows_merito += (f"<tr><td style='text-align:left;padding-left:6px;'>{m[0].title()}</td><td>{m[1]}</td>"
                     f"<td style='font-weight:700;color:#0e7c7b;'>R$ {m[2]}</td><td>{fmt(m[3],2)}</td></tr>")

pages.append(f"""<div class="page-break"></div><div class="page">
  {page_header("Página 15 · Meritocracia — Premiação por KM/L", "Fonte: BCNT.premiacao_atualizada — valor já calculado pela regra da empresa", f"Total pago ({MESREF_NOME})", f"R$ {gfd.MERITOCRACIA_RESUMO['total_pago']:,}".replace(",","."))}
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
      <div class="cons-text">{_p15_pct}% dos motoristas elegíveis ({gfd.MERITOCRACIA_RESUMO['distribuicao']['R$ 0']} de {gfd.MERITOCRACIA_RESUMO['total_motoristas']}) não receberam nenhum valor no mês — a régua de premiação está concentrada nas faixas de {_p15_faixas}, o que sugere espaço para uma faixa intermediária que incentive quem está perto de bater a meta, mas ainda não bate.</div></div>
    </div></div>
  </div>
  <div class="card"><div class="card-title">Top 10 maiores premiações ({MESREF})</div><div class="card-body" style="padding:6px 10px;">
    <table><thead><tr><th style="text-align:left;padding-left:10px;padding-top:4px;padding-bottom:4px;font-size:9px;">Motorista</th><th style="padding-top:4px;padding-bottom:4px;font-size:9px;">Chapa</th><th style="padding-top:4px;padding-bottom:4px;font-size:9px;">Valor</th><th style="padding-top:4px;padding-bottom:4px;font-size:9px;">KM/L</th></tr></thead>
    <tbody>{rows_merito.replace("padding-left:6px", "padding-left:10px").replace("<td", "<td style='padding-top:4px;padding-bottom:4px;font-size:10.5px;'")}</tbody></table>
  </div></div>
  {footer(15)}
</div>""")

# ================= PAGINA 11: DIVERGENCIA TELEMETRIA X TRANSNET =================
# "os 6 carros acima" e o corte ">25%" eram digitados; a lista tem tamanho variavel (o
# agregador corta em 8) e o menor desvio muda a cada semana.
# DIVERGENCIA_CARROS: (carro, kml_transnet, kml_telemetria, divergencia_pct, km).
_dv = list(gfd.DIVERGENCIA_CARROS)
_p16_n = len(_dv)
_p16_plural = "carro" if _p16_n == 1 else "carros"
_p16_essas = "esse caso não é apenas estilo de condução" if _p16_n == 1 else \
             f"os {_p16_n} casos acima não são apenas estilo de condução"
_p16_min = fmt(min(abs(d[3]) for d in _dv), 0) if _dv else "10"
rows_diverg = ""
for d in sorted(gfd.DIVERGENCIA_CARROS, key=lambda x: -abs(x[3])):
    rows_diverg += (f"<tr><td style='font-weight:bold;text-align:left;padding-left:6px;'>{d[0]}</td>"
                     f"<td>{fmt(d[1],3)}</td><td>{fmt(d[2],3)}</td>"
                     f"<td style='font-weight:800;color:{'#dc2626' if d[3]<0 else '#e0a800'};'>{pct(d[3])}</td>"
                     f"<td>{d[4]} km</td></tr>")

pages.append(f"""<div class="page-break"></div><div class="page">
  {page_header("Página 16 · Divergência Telemetria x Transnet por Carro (≥10%)", f"Fonte: CSV Athena (indicadores_carro_quatai) — {MESANT_NOME} a {MESREF}", "Carros com divergência ≥10%", str(len(gfd.DIVERGENCIA_CARROS)))}
  <div class="grid-2">
    <div class="card"><div class="card-title">Divergências ≥10% (mín. 500km no período)</div><div class="card-body">
      <div class="chart-wrap chart-wrap-tall"><img src="v3_divergencia.png"/></div>
    </div></div>
    <div class="card"><div class="card-title">Detalhamento</div><div class="card-body">
      <table class="tbl-big"><thead><tr><th style="text-align:left;padding-left:10px;">Carro</th><th>KM/L Transnet</th><th>KM/L Telemetria</th><th>Diferença</th><th>Km no período</th></tr></thead>
      <tbody>{rows_diverg.replace("padding-left:6px", "padding-left:10px")}</tbody></table>
      <div class="cons-box" style="margin-top:8px;"><div class="cons-title">Considerações</div>
      <div class="cons-text">Ao abrir o corte para ≥10%, nenhum carro novo aparece — a base é bimodal: ou a divergência é enorme (≥{_p16_min}%, {_p16_n} {_p16_plural} acima) ou é pequena (abaixo de 10%). Isso reforça que {_p16_essas}, e sim fortes candidatos a problema de calibração de sensor ou telemetria com falha de leitura. Recomenda-se checagem física nesses veículos antes de usar o dado de Telemetria para decisões individuais sobre eles.</div></div>
    </div></div>
  </div>
  {footer(16)}
</div>""")

# ================= PAGINA ADERENCIA — REMOVIDA POR ENQUANTO (regra em revisao) =================
# A pagina de Aderencia da Frota foi tirada temporariamente enquanto revisamos a regra
# (dias sem dado / frota / fins de semana). Reintroduzir depois de acertar a metodologia.

# [COWORK] PAGINA NOTURNA (17) — dados MANUAIS: ultima visita, descricao, proxima visita e FOTOS.
# Peca ao usuario e atualize aqui + embuta as fotos anexadas. Ver COWORK_FLASH.md.
# Fotos da visita: coloque os arquivos em flash-report-diesel/ e liste os nomes aqui.
FOTOS_NOTURNO_ARQUIVOS = ["noturno_jul_1.jpg", "noturno_jul_2.jpg",
                          "noturno_jul_3.jpg", "noturno_jul_4.jpg"]
# As fotos sao retrato (~1204x1600). Em celula baixa e larga o object-fit:cover corta
# justamente a cabeca, entao a celula e alta (170px) e o enquadramento sobe
# (object-position 20%) para manter rosto e tronco visiveis.
FOTOS_NOTURNO = "".join(
    f'<div style="border-radius:8px;overflow:hidden;border:1px solid #dbe3ee;height:170px;">'
    f'<img src="{_f}" style="width:100%;height:100%;object-fit:cover;'
    f'object-position:center 20%;display:block;"/></div>'
    for _f in FOTOS_NOTURNO_ARQUIVOS)
# ================= PAGINA 17: ACOMPANHAMENTO NOTURNO =================
pages.append(f"""<div class="page-break"></div><div class="page">
  {page_header("Página 17 · Acompanhamento Noturno", "Visitas de acompanhamento presencial no período noturno — garagem", "Próxima visita", "31/07")}
  <div class="grid-2">
    <div class="card"><div class="card-title">Calendário de visitas — {MESREF}</div><div class="card-body">
      <div style="display:grid;grid-template-columns:repeat(7,1fr);gap:4px;margin-bottom:2px;">{CAL_JULHO_HEADER}</div>
      <div style="display:grid;grid-template-columns:repeat(7,1fr);gap:4px;">{CAL_JULHO_CELLS}</div>
      <div class="cons-box" style="margin-top:8px;"><div class="cons-title">Programação</div>
      <div class="cons-text">{len(_visita_label)} visitas noturnas programadas para {MESREF_NOME.lower()} — {_visitas_datas} — mantendo a cadência mensal iniciada em {MESANT_NOME.lower()}. Cada visita inclui verificação de manobras no pátio, orientação aos motoristas em campo e reforço das boas práticas de condução econômica.</div></div>
    </div></div>
    <div class="card"><div class="card-title">Última visita realizada — 17/07/2026</div><div class="card-body">
      <div style="font-weight:800;font-size:10.5px;color:#0f172a;margin-bottom:4px;">Treinamento Prático de Manobristas</div>
      <div class="cons-text" style="text-align:justify;">Foi realizado um treinamento prático com os manobristas em vias públicas, com foco no aperfeiçoamento da condução, direção preventiva, cumprimento das normas de trânsito e adoção de boas práticas operacionais. A iniciativa reforça o compromisso com a segurança, a qualidade do serviço e a preparação dos profissionais para uma condução cada vez mais segura e eficiente.</div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:5px;margin-top:7px;">{FOTOS_NOTURNO}</div>
      <div class="metric" style="margin-top:7px;"><div class="lbl">Próxima visita programada</div><div class="val" style="font-size:13px;">31/07/2026</div></div>
    </div></div>
  </div>
  {footer(17)}
</div>""")

# [COWORK] CRONOGRAMA (18) — dado MANUAL: regenere este HTML com as semanas/itens do mes que o
# usuario informar (mesmo estilo de cards). Ver COWORK_FLASH.md.
# ================= PAGINA 18: PROGRAMACAO DA SEMANA =================
# Estrutura: (titulo_semana, intervalo, [(tipo, tema, data, executado), ...])
# executado=False -> item pendente (bolinha vazia + data em vermelho), igual ao board.
CRONOGRAMA = [
    ("1ª Semana", "01 a 03/07", [
        ("Imagem Informativa", "Tamo no Zap: a ferramenta que facilita o seu dia a dia!", "01/07", True),
        ("Podcast - Fala, Motô!", "Fugindo de Reclamações e Tratativas: a importância do bom atendimento", "02/07", True),
        ("Enquete de Fixação", "Tamo no Zap: a ferramenta que facilita o seu dia a dia!", "03/07", True),
    ]),
    ("2ª Semana", "06 a 10/07", [
        ("Imagem Motivacional", "", "06/07", True),
        ("Vídeo - Min. do Conhecimento", "Lei nº 3.888/2025 – Programa Parada Legal", "07/07", True),
        ("Imagem Informativa", "Lei nº 3.888/2025 – Programa Parada Legal", "08/07", True),
        ("Podcast - Fala, Motô!", "O Motorista que Conquista Pessoas", "09/07", True),
        ("Enquete de Fixação", "Lei nº 3.888/2025 – Programa Parada Legal", "10/07", True),
    ]),
    ("3ª Semana", "13 a 17/07", [
        ("Imagem Motivacional", "", "13/07", True),
        ("Vídeo - Min. do Conhecimento", "Desconecte do Celular. Conecte-se à Vida", "14/07", True),
        ("Imagem Informativa", "Desconecte do Celular. Conecte-se à Vida: o perigo do uso do celular ao volante", "15/07", True),
        ("Podcast - Fala, Motô!", "", "16/07", False),
        ("Enquete de Fixação", "Desconecte do Celular. Conecte-se à Vida: o perigo do uso do celular ao volante", "17/07", True),
    ]),
]

_ROW = ('<div style="display:flex;justify-content:space-between;align-items:flex-start;'
        'padding:4px 0;border-bottom:1px solid #eef2f7;"><div style="flex:1;">'
        '<span style="color:{cor};font-weight:800;margin-right:4px;">{marca}</span>'
        '<span style="font-size:8.6px;font-weight:700;color:#0f172a;">{tipo}</span>{sub}</div>'
        '<div style="font-size:8px;color:{cor_data};font-weight:700;white-space:nowrap;'
        'margin-left:6px;">{data}</div></div>')


def _crono_card(titulo, intervalo, itens):
    linhas = ""
    for tipo, tema, data, feito in itens:
        sub = (f'<div style="font-size:7.6px;color:#475569;margin-top:1px;">{tema}</div>'
               if tema else "")
        linhas += _ROW.format(cor="#16a34a" if feito else "#cbd5e1",
                              marca="&#10003;" if feito else "&#9675;",
                              tipo=tipo, sub=sub, data=data,
                              cor_data="#64748b" if feito else "#dc2626")
    return (f'<div class="card" style="margin-bottom:7px;"><div class="card-title">{titulo} — {MESREF} '
            f'<span style="font-weight:400;opacity:.85;">({intervalo})</span></div>'
            f'<div class="card-body" style="padding:6px 10px;">{linhas}</div></div>')


_crono_cards = [_crono_card(t, i, its) for t, i, its in CRONOGRAMA]
_n_itens = sum(len(its) for _, _, its in CRONOGRAMA)
_n_feitos = sum(1 for _, _, its in CRONOGRAMA for it in its if it[3])
# lista de pendentes derivada do proprio CRONOGRAMA, para nao contradizer os checks
_pend = [(t, d) for _, _, its in CRONOGRAMA for t, _tema, d, feito in its if not feito]
_crono_pend = ("Consta pendente: " + "; ".join(f"{t} de {d}" for t, d in _pend) + "."
               if _pend else "Todos os conteúdos previstos foram executados.")
_metade = (len(_crono_cards) + 1) // 2
_crono_left = "".join(_crono_cards[:_metade])
_crono_right = "".join(_crono_cards[_metade:])
pages.append(f"""<div class="page-break"></div><div class="page">
  {page_header("Página 18 · Programação Educativa — Conteúdo Motorista/Motô", f"Cronograma de comunicação e engajamento, semana a semana — {MESREF}", "Conteúdos executados", f"{_n_feitos}/{_n_itens}")}
  <div class="grid-2" style="align-items:start;">
    <div>{_crono_left}</div>
    <div>{_crono_right}
      <div class="cons-box"><div class="cons-title">Sobre o cronograma</div>
      <div class="cons-text">Programação semanal de comunicação e engajamento com os motoristas, combinando imagem motivacional, vídeo de conhecimento, imagem informativa, podcast e enquete de fixação. Das {len(CRONOGRAMA)} semanas de {MESREF_NOME.lower()}, {_n_feitos} dos {_n_itens} conteúdos foram executados — as séries de destaque foram a Lei nº 3.888/2025 (Programa Parada Legal) e "Desconecte do Celular. Conecte-se à Vida", sobre o perigo do uso do celular ao volante. {_crono_pend}</div></div>
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

# Os tres destaques do topo e o texto de instrutores eram fixos e citavam carros que a
# Pagina 16 e a 14 mostram ao vivo - o relatorio se contradizia entre paginas.
_p19_alta = [t for t in gfd.TRATATIVAS_ATRASADAS if t[4] > 90]
_p19_acao = (f"{len(_p19_alta)} tratativa{'s' if len(_p19_alta)!=1 else ''} &gt;90 dias em aberto"
             if _p19_alta else "Nenhuma tratativa &gt;90 dias")
_p19_acao_aux = (", ".join(t[0].title().split()[0] for t in _p19_alta[:3])
                 + (f" — prioridade {_Counter(t[3] for t in _p19_alta).most_common(1)[0][0]}"
                    if _p19_alta else "")) if _p19_alta else "SLA em dia nas tratativas antigas"
_p19_div = max(gfd.DIVERGENCIA_CARROS, key=lambda d: abs(d[3])) if gfd.DIVERGENCIA_CARROS else None
_p19_inv = f"Carro {_p19_div[0]} — sensor?" if _p19_div else "Sem divergência relevante"
_p19_inv_aux = (f"{pct(_p19_div[3])} de divergência Telemetria x Transnet" if _p19_div
                else "nenhum carro acima do corte")
_v30 = [v for v in gfd.VEICULO_30_DIAS if v[5] and v[6]]
_p19_best = max(_v30, key=lambda v: v[5]-v[6]) if _v30 else None
_p19_rep = (f"Carro {_p19_best[2]} rende +{fmt(_p19_best[5]-_p19_best[6],2)} km/L"
            if _p19_best else "Sem efeito de carro destacado")
_p19_foco = gfd.SUGESTOES_LINHAS[0][0] if gfd.SUGESTOES_LINHAS else "—"
_carros_ok = ", ".join(str(v[2]) for v in sorted(_v30, key=lambda v: -(v[5]-v[6]))[:2]) or "—"
_taxas19 = [i["taxa_atingiu_meta"] for i in gfd.INSTRUTORES] or [0]
_apr19 = [i["aproveitamento_dia_pct"] for i in gfd.INSTRUTORES_DIARIO] or [0]
_txt_p19_inst = (
    f"Os instrutores convertem em media {fmt(sum(_taxas19)/len(_taxas19),0)}% dos "
    f"acompanhamentos em meta batida, ocupando ~{fmt(sum(_apr19)/len(_apr19),0)}% da jornada. "
    f"Sugestão: nas próximas 2 semanas, testar ciclos mais curtos (10 dias) com reforço "
    f"presencial logo no início, focando nos motoristas que já usam os carros de melhor "
    f"rendimento (ex.: {_carros_ok}) para isolar se o problema é comportamental.")

rows_sug_linhas = ""
for s in gfd.SUGESTOES_LINHAS:
    rows_sug_linhas += (f"<tr><td style='font-weight:bold;text-align:left;padding-left:6px;'>{s[0]}</td>"
                         f"<td style='text-align:left;font-size:8px;'>{s[1]}</td>"
                         f"<td style='text-align:left;font-size:8px;color:#0e7c7b;font-weight:700;'>{s[2]}</td></tr>")

pages.append(f"""<div class="page-break"></div><div class="page">
  {page_header("Página 19 · Melhoria Contínua — Plano de Ação da Semana", "Síntese analítica sobre tratativas, acompanhamentos, linhas, carros e instrutores", "Foco #1 da semana", _p19_foco)}
  <div class="grid-3" style="margin-bottom:6px;">
    <div class="metric" style="background:#fef2f2;border-color:#fecaca;"><div class="lbl" style="color:#dc2626;">Ação imediata</div><div class="val" style="font-size:11px;color:#0f172a;">{_p19_acao}</div><div class="aux">{_p19_acao_aux}</div></div>
    <div class="metric" style="background:#fffbeb;border-color:#fde68a;"><div class="lbl" style="color:#b45309;">Investigar</div><div class="val" style="font-size:11px;color:#0f172a;">{_p19_inv}</div><div class="aux">{_p19_inv_aux}</div></div>
    <div class="metric" style="background:#f0fdf4;border-color:#bbf7d0;"><div class="lbl" style="color:#15803d;">Replicar</div><div class="val" style="font-size:11px;color:#0f172a;">{_p19_rep}</div><div class="aux">Vale testar em outros motoristas da mesma linha</div></div>
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
    <div class="cons-text">{_txt_p19_inst}</div></div>
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
