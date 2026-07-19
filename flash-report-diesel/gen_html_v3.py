# Monta o HTML (paginas, A4 paisagem) do Flash Report Diesel v3 e converte pra PDF.
from pathlib import Path
from collections import Counter as _Counter
import re as _re
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
.title { padding-right:12px; }
.title h1 { margin:0; font-size:19px; line-height:1.12; color:#0f172a; letter-spacing:.2px; }
.title .sub { margin-top:4px; font-size:9.5px; color:#475569; }
.period-box { min-width:200px; text-align:right; background:linear-gradient(135deg,#0f172a 0%,#0e7c7b 100%); color:white; padding:8px 12px; border-radius:12px; }
.period-box .ref { font-size:8.5px; text-transform:uppercase; font-weight:700; opacity:.85; }
.period-box .val { font-size:14px; font-weight:800; margin-top:2px; }
.grid-2 { display:grid; grid-template-columns:1fr 1fr; gap:10px; margin-bottom:8px; }
.grid-38-62 { display:grid; grid-template-columns:38fr 62fr; gap:10px; margin-bottom:8px; }
.tbl-alerta td, .tbl-alerta th { padding:4px 5px; font-size:8.2px; }
.tbl-alerta th { font-size:7.4px; }
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
.chart-wrap-tall img { max-height:88mm; width:auto; max-width:100%; }
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

INDICE = []      # (numero, assunto) preenchido por page_header, consumido pelo indice
# Numeracao automatica: o numero da pagina era digitado em dois lugares por pagina (no
# titulo e no footer). Dividir ou reordenar uma pagina obrigava a renumerar tudo na mao,
# e bastava esquecer um para o rodape mentir. Agora page_header incrementa e o footer le.
_NUM = [1]       # a capa e a pagina 1


def page_header(titulo_pag, sub, ref_label, ref_val, numerar=True):
    """Cabecalho no padrao do Flash de Manutencao: o ASSUNTO da pagina em destaque.

    Antes o H1 era "CONDUÇÃO ECONÔMICA — FLASH REPORT DIESEL" nas 19 paginas, e o assunto
    ficava na letra miuda - o leitor folheava sem saber onde estava. O nome do relatorio
    ja aparece na capa e no rodape de toda pagina, entao nao precisa se repetir aqui.
    Recebe "Página N · Assunto" e separa: o assunto sobe para o titulo, o numero desce.
    """
    # O "Página N ·" que vem na string e descartado: quem manda e o contador.
    m = _re.match(r"\s*Página\s+\d+\s*·\s*(.+)", titulo_pag)
    assunto = m.group(1) if m else titulo_pag
    if not numerar:
        # O indice e capa nao entram na contagem nem no proprio indice. Sem isso ele
        # herdava o ultimo numero (saia "Página 21" no cabecalho do indice).
        return f"""<div class="header">
    <div class="title"><h1>{assunto.upper()}</h1>
      <div class="sub">{sub}</div></div>
    <div class="period-box"><div class="ref">{ref_label}</div><div class="val">{ref_val}</div></div>
  </div>"""
    _NUM[0] += 1
    # Guarda o assunto na grafia original: o indice precisa dele antes do .upper(),
    # senao nao consegue distinguir sigla ("KM/L") de palavra em caixa alta.
    INDICE.append((_NUM[0], assunto))
    linha = " · ".join(x for x in (f"Página {_NUM[0]}", sub) if x)
    return f"""<div class="header">
    <div class="title"><h1>{assunto.upper()}</h1>
      <div class="sub">{linha}</div></div>
    <div class="period-box"><div class="ref">{ref_label}</div><div class="val">{ref_val}</div></div>
  </div>"""

def footer(pagina=None):
    """O argumento e ignorado (mantido so para nao mexer nas 18 chamadas existentes):
    o numero vem do contador, e o total e substituido no fim, quando ja se sabe quantas
    paginas foram geradas."""
    return f"""<div class="footer"><div>Gerado automaticamente via Cowork · Página {_NUM[0]}/@@TOTAL@@</div><div>Flash Report Diesel — Transnet oficial + Telemetria</div></div>"""

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

# "Sempre abaixo da meta" e "tendencia erratica" eram afirmacoes fixas; agora as duas sao
# verificadas contra os dados antes de irem para o texto.
_h_vals = [m[1] for m in gfd.KML_HISTORICO]
_h_min, _h_max = min(_h_vals), max(_h_vals)
_abaixo_meta = _h_max < gfd.META
_sem_vars = [(b - a) / a * 100 for a, b in zip([s[1] for s in gfd.KML_SEMANAL][:-1],
                                               [s[1] for s in gfd.KML_SEMANAL][1:])]
_pos = sum(1 for v in _sem_vars if v > 0)
if not _sem_vars:
    _tend = "sem semanas suficientes para avaliar tendência"
elif _pos >= len(_sem_vars) * 0.7:
    _tend = "com tendência recente de melhora contínua"
elif _pos <= len(_sem_vars) * 0.3:
    _tend = "com tendência recente de queda contínua"
else:
    _tend = ("alternando altas e quedas sem tendência clara, o que sugere problema "
             "estrutural (linhas/trânsito) e não um evento pontual")
_txt_p2 = (f"Nos últimos {len(gfd.KML_HISTORICO)} meses a frota oscilou entre "
           f"{fmt(_h_min,3)} e {fmt(_h_max,3)} km/L pelo Transnet"
           + (f", sempre abaixo da meta de {fmt(gfd.META,2)}." if _abaixo_meta
              else f"; o melhor mês superou a meta de {fmt(gfd.META,2)}.")
           + f" Semana a semana, a variação vem {_tend}.")
_telem_key = gfd._MES3[gfd.MES_REF_MM - 1].lower()
# Sem default para o ultimo valor do dict: em agosto a chave "ago" nao existia e o tile
# exibia o numero de julho rotulado como agosto, sem nenhuma marca de que era de outro mes.
_telem_val = gfd.KML_MENSAL_TELEMETRIA.get(_telem_key)
_telem_txt = fmt(_telem_val, 3) if _telem_val else "n/d"
pages.append(f"""<div class="page-break"></div><div class="page">
  {page_header(f"Página 2 · KM/L Mensal — Histórico de {len(gfd.KML_HISTORICO)} Meses (Transnet oficial)", f"Período: <b>{periodo_label}</b>", "Mês de referência", MESREF)}
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
  <div class="cons-text">{_txt_p2}</div></div>
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
  {page_header("Página 4 · Análise por Linha — KM/L, Meta e Desperdício", "Fonte: premiacao_diaria_atualizada (Telemetria)", "Linhas monitoradas", str(len(gfd.LINHA_DESPERDICIO)))}
  <div class="grid-4">
    <div class="metric"><div class="lbl">KM/L Mês Referência</div><div class="val">{fmt(kml_ref_pond,2)}</div></div>
    <div class="metric"><div class="lbl">KM/L Mês Comparação</div><div class="val">{fmt(kml_comp_medio,2)}</div></div>
    <div class="metric"><div class="lbl">Variação vs comparação</div><div class="val" style="color:{'#16a34a' if var_geral>=0 else '#dc2626'};">{pct(var_geral)}</div></div>
    <div class="metric"><div class="lbl">Desperdício Total (Meta)</div><div class="val" style="color:#dc2626;">{fmt(desperdicio_total,2)} L</div></div>
  </div>
  <div class="card"><div class="card-title">Detalhamento por linha ({MESREF_NOME} = referência, {MESANT_NOME} = comparação)</div><div class="card-body">
    <table class="tbl-alerta"><thead><tr><th style="text-align:left;padding-left:10px;">Linha</th><th>KM/L Comp.</th><th>KM/L Ref.</th><th>Var. %</th><th>Meta</th><th>Desperdício</th><th>Km</th><th>Comb.</th></tr></thead>
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
# Recorte dia util x fim de semana: e o que da acao pratica a correlacao. Sem transito, o
# KM/L sobe - entao a diferenca entre os dois grupos mede o teto que o transito impoe.
import datetime as _dt6
_uteis, _fds = [], []
for _d in _vk:
    try:
        _dd, _mm = int(_d[0][:2]), int(_d[0][3:5])
        _wd = _dt6.date(gfd.MES_REF_ANO, _mm, _dd).weekday()
    except (ValueError, IndexError):
        continue
    (_fds if _wd >= 5 else _uteis).append(_d)
_med = lambda g: (sum(x[1] for x in g) / len(g)) if g else 0
_med_v = lambda g: (sum(x[2] for x in g) / len(g)) if g else 0
_kml_util, _kml_fds = _med(_uteis), _med(_fds)
_dif_fds = _kml_fds - _kml_util
_melhor = max(_vk, key=lambda d: d[1]) if _vk else None
_pior = min(_vk, key=lambda d: d[1]) if _vk else None
_amp = (_melhor[1] - _pior[1]) if _vk else 0

if not _vk:
    consid_p6 = "Sem dados diários suficientes de velocidade e KM/L nesta janela para avaliar a correlação."
    consid_p6b = ""
else:
    consid_p6 = (f"Correlação {_forca} e {_sinal} entre velocidade média diária e KM/L (r = {fmt(_r,2)}): "
                 f"os dias com velocidade média mais alta (acima de ~{fmt(_vel_med,0)} km/h, tipicamente com menos trânsito) "
                 f"tendem a apresentar KM/L {_tend}. Isso ajuda a entender por que as linhas urbanas mais lentas ficam distantes da meta"
                 + (", e reforça que trânsito/parada explica parte do desperdício." if _r >= 0.2 else "; ainda assim, o efeito observado nesta janela é pequeno."))
    if _uteis and _fds:
        consid_p6b = (
            f"Separando os dias: em dia útil a frota faz {fmt(_kml_util,3)} km/L a "
            f"{fmt(_med_v(_uteis),1)} km/h; no fim de semana, {fmt(_kml_fds,3)} km/L a "
            f"{fmt(_med_v(_fds),1)} km/h — diferença de {fmt(abs(_dif_fds),3)} km/L "
            f"({pct(100*_dif_fds/_kml_util if _kml_util else 0)}) com a mesma frota e os mesmos "
            f"motoristas. Essa distância é a parcela que o trânsito impõe, e não se resolve com "
            f"cobrança de condução: o ganho realista em dia útil está abaixo desse teto.")
    else:
        consid_p6b = ("Ainda não há dias úteis e de fim de semana suficientes nesta janela para "
                      "separar o efeito do trânsito do efeito de condução.")

pages.append(f"""<div class="page-break"></div><div class="page">
  {page_header("Página 6 · Velocidade Média Diária x KM/L — Correlação", f"Fonte: premiacao_diaria_atualizada (Telemetria) — {PERIODO}", "Dias analisados", str(len(gfd.KML_VELOCIDADE_DIARIO)))}
  <div class="grid-4" style="margin-bottom:6px;">
    <div class="metric"><div class="lbl">Correlação (r)</div><div class="val">{fmt(_r,2)}</div><div class="aux">{_forca} e {_sinal}</div></div>
    <div class="metric"><div class="lbl">Dia útil</div><div class="val">{fmt(_kml_util,3)}</div><div class="aux">{fmt(_med_v(_uteis),1)} km/h · {len(_uteis)} dias</div></div>
    <div class="metric"><div class="lbl">Fim de semana</div><div class="val" style="color:#16a34a;">{fmt(_kml_fds,3)}</div><div class="aux">{fmt(_med_v(_fds),1)} km/h · {len(_fds)} dias</div></div>
    <div class="metric"><div class="lbl">Amplitude no mês</div><div class="val">{fmt(_amp,3)}</div><div class="aux">{f"pior {_pior[0]} · melhor {_melhor[0]}" if _vk else "—"}</div></div>
  </div>
  <div class="grid-2">
    <div class="card"><div class="card-title">Cada dia como um ponto — quanto a velocidade explica o KM/L</div><div class="card-body">
      <div class="chart-wrap chart-wrap-tall"><img src="v3_vel_kml_dispersao.png"/></div>
    </div></div>
    <div class="card"><div class="card-title">As duas curvas dia a dia</div><div class="card-body">
      <div class="chart-wrap chart-wrap-tall"><img src="v3_vel_kml_diario.png"/></div>
    </div></div>
  </div>
  <div class="grid-2">
    <div class="cons-box" style="margin-top:0;"><div class="cons-title">Considerações</div>
    <div class="cons-text">{consid_p6}</div></div>
    <div class="cons-box" style="margin-top:0;"><div class="cons-title">Quanto disso é trânsito, e não condução</div>
    <div class="cons-text">{consid_p6b}</div></div>
  </div>
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

# A leitura afirmava "a maioria ja esta em algum estagio" sem contar. Agora conta - e o que
# interessa de verdade e o inverso: quem esta no top 10 e NAO tem nenhuma acao aberta.
# PIORES: (nome, chapa, kml_real, meta, km, litros).
# ---- Falso melhor / falso pior ------------------------------------------------------
# O KM/L do ranking vem da Telemetria. Se o carro que o motorista mais usou tem sensor
# divergente do Transnet, o numero dele esta inflado (ou deprimido) pelo equipamento, nao
# pela conducao — e ele pode estar no top 10 sem merecer, ou no fundo sem culpa.
# DIVERGENCIA_CARROS: (carro, kml_transnet, kml_telemetria, div_pct, km).
_DIV_MIN = 10.0            # so carros com divergencia relevante
_KM_MIN_CARRO = 50.0       # e que representem parte relevante da rodagem do motorista
_div_por_carro = {str(d[0]): d for d in gfd.DIVERGENCIA_CARROS}


# So mostra a seta quando houve troca: "11TR → 11TR" ocupava o dobro da largura para dizer
# que nada mudou, e era o que espremia as tabelas das paginas 9 e 10. No nivel do modulo
# porque as duas usam - dentro do laco, deixava de existir se a lista viesse vazia.
def _mudou(de, para):
    de, para = str(de or "-"), str(para or "-")
    if de in ("-", "") or para in ("-", ""):
        return "—"
    return de if de == para else f"{de}<span style='color:#94a3b8;'>→</span>{para}"


def _suspeitos(lista, sentido, com_chapa=True):
    """Motoristas cujo carro principal tem sensor divergente no sentido que os favorece
    (sentido=+1 para quem aparece bem, -1 para quem aparece mal). Devolve (motorista,
    carro, pct_km, divergencia).

    com_chapa=False para as listas que guardam so o nome (SINAL_ALERTA,
    DESTAQUE_POSITIVO): a chapa e resolvida por CHAPA_DE_NOME.
    """
    out = []
    for d in lista:
        _ch = str(d[1]) if com_chapa else gfd.CHAPA_DE_NOME.get(str(d[0]).strip().upper(), "")
        carro, pct_km = gfd.CARRO_PRINCIPAL.get(_ch, (None, 0))
        if not carro:
            continue
        dv = _div_por_carro.get(str(carro))
        if not dv or abs(dv[3]) < _DIV_MIN or pct_km < _KM_MIN_CARRO:
            continue
        # sentido do vies: telemetria acima do Transnet infla o KM/L do motorista
        if (dv[3] > 0 and sentido > 0) or (dv[3] < 0 and sentido < 0):
            out.append((d[0].title(), carro, pct_km, dv[3]))
    return out


def _bloco_suspeitos(susp, total, titulo, explica):
    if not gfd.CARRO_PRINCIPAL or not gfd.DIVERGENCIA_CARROS:
        # Sem o mapa motorista->carro nao da para afirmar que esta limpo: seria dizer
        # "verificado, nada encontrado" quando na verdade nao foi verificado.
        return (f'<div class="cons-box" style="margin-top:0;"><div class="cons-title">{titulo}</div>'
                f'<div class="cons-text">Não foi possível cruzar o ranking com os carros de '
                f'sensor divergente nesta execução — a verificação de falso positivo não foi '
                f'feita.</div></div>')
    if not susp:
        return (f'<div class="cons-box" style="margin-top:0;"><div class="cons-title">{titulo}</div>'
                f'<div class="cons-text">Nenhum dos {total} está apoiado em carro com '
                f'divergência de sensor acima de {fmt(_DIV_MIN,0)}% — o ranking desta página '
                f'não parece contaminado por leitura de equipamento.</div></div>')
    _itens = "; ".join(f"<b>{n}</b> (carro {c}, {fmt(p,0)}% da rodagem, sensor {pct(dv)})"
                       for n, c, p, dv in susp)
    return (f'<div class="cons-box" style="margin-top:0;background:#fffbeb;border-color:#fde68a;">'
            f'<div class="cons-title" style="color:#b45309;">{titulo}</div>'
            f'<div class="cons-text">{len(susp)} de {total} {explica} {_itens}. '
            f'Confira o sensor destes veículos (página de divergência) antes de usar este '
            f'ranking para premiação ou cobrança.</div></div>')


_susp_piores = _suspeitos(gfd.PIORES, -1)       # sensor lendo a menos derruba o KM/L
_ph = gfd.PIORES_HISTORICO
_tem_ac = [d for d in gfd.PIORES if _ph.get(d[1], ("-",))[0] not in ("-", "OK")]
_tem_tr = [d for d in gfd.PIORES if _ph.get(d[1], ("-", "-", "-"))[2] not in ("-", "")]
_sem_nada = [d for d in gfd.PIORES
             if _ph.get(d[1], ("-",))[0] in ("-", "OK") and _ph.get(d[1], ("-", "-", "-"))[2] in ("-", "")]
_gaps = [d[2] - d[3] for d in gfd.PIORES]
_gap_med = sum(_gaps) / len(_gaps) if _gaps else 0
_litros_perdidos = sum((d[3] - d[2]) * d[4] / d[3] for d in gfd.PIORES if d[3])

if _sem_nada:
    _p7_leitura = (
        f"{len(_tem_ac)} dos {len(gfd.PIORES)} motoristas mais distantes da meta já estão em "
        f"acompanhamento e {len(_tem_tr)} têm tratativa registrada. Mas "
        f"<b>{len(_sem_nada)} seguem sem nenhuma ação aberta</b> "
        f"({', '.join(d[0].title() for d in _sem_nada)}) — são a lacuna mais direta desta "
        f"página, porque estão entre os piores e ninguém os está acompanhando.")
else:
    _p7_leitura = (
        f"Todos os {len(gfd.PIORES)} motoristas mais distantes da meta já estão em algum "
        f"estágio de acompanhamento ou tratativa ({len(_tem_ac)} acompanhados, "
        f"{len(_tem_tr)} com tratativa) — o desafio não é falta de ação, mas a velocidade de "
        f"conversão desses casos em melhoria efetiva de KM/L.")

pages.append(f"""<div class="page-break"></div><div class="page">
  {page_header("Página 7 · Top 10 — Maior Distância da Meta", f"Período: <b>{periodo_label}</b>", "Mês de referência", MESREF)}
  <div class="grid-4" style="margin-bottom:6px;">
    <div class="metric"><div class="lbl">Defasagem média</div><div class="val" style="color:#dc2626;">{fmt(_gap_med,3)}</div><div class="aux">km/L abaixo da meta individual</div></div>
    <div class="metric"><div class="lbl">Em acompanhamento</div><div class="val">{len(_tem_ac)}/{len(gfd.PIORES)}</div><div class="aux">ciclo aberto com instrutor</div></div>
    <div class="metric"><div class="lbl">Com tratativa</div><div class="val">{len(_tem_tr)}/{len(gfd.PIORES)}</div><div class="aux">registro formal aberto</div></div>
    <div class="metric" style="{'background:#fef2f2;border-color:#fecaca;' if _sem_nada else ''}"><div class="lbl" style="{'color:#dc2626;' if _sem_nada else ''}">Sem nenhuma ação</div><div class="val" style="{'color:#dc2626;' if _sem_nada else 'color:#16a34a;'}">{len(_sem_nada)}</div><div class="aux">{'exigem abertura de acompanhamento' if _sem_nada else 'todos cobertos'}</div></div>
  </div>
  <div class="grid-2">
    <div class="card"><div class="card-title">Distância da meta — KM/L real x meta individual</div><div class="card-body">
      <div class="chart-wrap chart-wrap-tall"><img src="v3_piores.png"/></div>
    </div></div>
    <div class="card"><div class="card-title">Detalhamento — com último acompanhamento e última tratativa</div><div class="card-body">
      <table class="tbl-big"><thead><tr><th style="text-align:left;padding-left:10px;">Motorista</th><th>Chapa</th><th>KM/L Real</th><th>Meta</th><th>Último Acompanhamento</th><th>Última Tratativa</th></tr></thead>
      <tbody>{rows_piores.replace("padding-left:6px", "padding-left:10px").replace("font-size:7.4px", "font-size:8.6px")}</tbody></table>
    </div></div>
  </div>
  <div class="grid-2">
    <div class="cons-box" style="margin-top:0;"><div class="cons-title">Leitura</div>
    <div class="cons-text">{_p7_leitura} Somados, estes {len(gfd.PIORES)} motoristas representam cerca de <b>{fmt(_litros_perdidos,0)} litros</b> acima do que consumiriam na meta, no período.</div></div>
    {_bloco_suspeitos(_susp_piores, len(gfd.PIORES), "Possível falso pior — verificar sensor", "podem estar no fundo do ranking por leitura do equipamento, e não por condução:")}
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

# Quantos dos que cairam trocaram de linha/carro (causa operacional) e quantos nao trocaram
# nada (ai sim aponta para conducao). E a leitura que a pagina precisa entregar.
_susp_alerta = _suspeitos(gfd.SINAL_ALERTA, -1, com_chapa=False)
# Tabela unica: o KM/L antes/depois era montado (rows_alerta) e nunca exibido, entao a
# pagina mostrava a queda em % sem dizer de quanto para quanto. Agora as duas informacoes
# ficam na mesma linha, junto da causa provavel.
# SINAL_ALERTA: (nome, kml_ant, kml_ref, var_pct) · SINAL_ALERTA_CAUSA: (nome, linha_ant,
# linha_ref, carro_ant, carro_ref, mudou_linha, mudou_carro).
_causa_por_nome = {str(c[0]).strip().upper(): c for c in gfd.SINAL_ALERTA_CAUSA}
rows_alerta_full = ""
for a in gfd.SINAL_ALERTA:
    c = _causa_por_nome.get(str(a[0]).strip().upper())
    if c and c[5] is None:
        causa, cor = "Sem dado suficiente", "#64748b"
    elif c and c[5] and c[6]:
        causa, cor = "Trocou de linha e de carro", "#e0a800"
    elif c and c[6]:
        causa, cor = "Trocou de carro (mesma linha)", "#e0a800"
    elif c and c[5]:
        causa, cor = "Trocou de linha (mesmo carro)", "#e0a800"
    elif c:
        causa, cor = "Sem troca — condução", "#dc2626"
    else:
        causa, cor = "—", "#64748b"
    _lin = _mudou(c[1], c[2]) if c else "—"
    _car = _mudou(c[3], c[4]) if c else "—"
    rows_alerta_full += (
        f"<tr><td style='text-align:left;padding-left:8px;white-space:nowrap;'>{a[0].title()}</td>"
        f"<td>{fmt(a[1],3)}</td><td style='font-weight:700;'>{fmt(a[2],3)}</td>"
        f"<td style='color:#dc2626;font-weight:800;'>{pct(a[3])}</td>"
        f"<td style='white-space:nowrap;'>{_lin}</td><td style='white-space:nowrap;'>{_car}</td>"
        f"<td style='text-align:left;color:{cor};font-weight:700;'>{causa}</td></tr>")

_al = list(gfd.SINAL_ALERTA)
_al_queda_med = (sum(d[3] for d in _al) / len(_al)) if _al else 0
_al_perda = sum((d[1] - d[2]) for d in _al)
_ca = list(gfd.SINAL_ALERTA_CAUSA)
_ca_comport = [c for c in _ca if c[5] is not None and not c[5] and not c[6]]
_ca_troca = [c for c in _ca if c[5] or c[6]]
_ca_semdado = [c for c in _ca if c[5] is None]
if _ca:
    _txt_alerta = (
        f"Dos {len(_ca)} motoristas com maior queda, <b>{len(_ca_troca)}</b> trocaram de linha "
        f"e/ou de carro no período — a queda tem explicação operacional e cobrar condução "
        f"deles seria injusto. <b>{len(_ca_comport)}</b> mantiveram linha e carro, e são os "
        f"casos em que a queda aponta de fato para a forma de dirigir"
        + (f"; {len(_ca_semdado)} ficaram sem dado suficiente para classificar." if _ca_semdado
           else ".")
        + " Priorize os que não trocaram nada.")
else:
    _txt_alerta = "Sem motoristas com queda relevante nesta janela."

# Uma pagina por assunto: "Top 10 Melhores" e "Sinal de Alerta" dividiam a mesma pagina,
# com dois graficos e duas tabelas espremidos - as tabelas de baixo saiam cortadas pelo
# rodape. Sao perguntas diferentes (quem foi bem x quem caiu) e agora tem cada uma a sua.
_susp_melhores = _suspeitos(gfd.MELHORES, +1)   # sensor lendo a mais infla o KM/L
_mel = list(gfd.MELHORES)
_mel_acima = [m for m in _mel if m[2] >= m[3]]
_mel_gap = [m[2] - m[3] for m in _mel]
_mel_econ = sum((m[2] - m[3]) * m[4] / m[3] for m in _mel if m[3])

pages.append(f"""<div class="page-break"></div><div class="page">
  {page_header("Página 8 · Top 10 Melhores — Quem Está Acima da Meta", f"Período: <b>{periodo_label}</b>", "Mês de referência", MESREF)}
  <div class="grid-4" style="margin-bottom:6px;">
    <div class="metric"><div class="lbl">Acima da meta</div><div class="val" style="color:#16a34a;">{len(_mel_acima)}/{len(_mel)}</div><div class="aux">no recorte dos 10 melhores</div></div>
    <div class="metric"><div class="lbl">Melhor KM/L</div><div class="val">{fmt(_mel[0][2],3) if _mel else "—"}</div><div class="aux">{_mel[0][0].title() if _mel else "—"}</div></div>
    <div class="metric"><div class="lbl">Vantagem média</div><div class="val" style="color:#16a34a;">+{fmt(sum(_mel_gap)/len(_mel_gap),3) if _mel_gap else "—"}</div><div class="aux">km/L acima da meta individual</div></div>
    <div class="metric"><div class="lbl">Economia no período</div><div class="val" style="color:#16a34a;">{fmt(_mel_econ,0)} L</div><div class="aux">abaixo do previsto pela meta</div></div>
  </div>
  <div class="grid-2">
    <div class="card"><div class="card-title">Vantagem sobre a meta — KM/L real x meta individual</div><div class="card-body">
      <div class="chart-wrap chart-wrap-tall"><img src="v3_melhores.png"/></div>
    </div></div>
    <div class="card"><div class="card-title">Detalhamento — Top 10 melhores</div><div class="card-body">
      <table class="tbl-big"><thead><tr><th style="text-align:left;padding-left:10px;">Motorista</th><th>Chapa</th><th>KM/L Real</th><th>Meta</th><th>Km</th><th>Comb.</th></tr></thead>
      <tbody>{rows_melhores.replace("padding-left:6px", "padding-left:10px")}</tbody></table>
    </div></div>
  </div>
  <div class="grid-2">
    <div class="cons-box" style="margin-top:0;"><div class="cons-title">Leitura</div>
    <div class="cons-text">Estes {len(_mel)} motoristas economizaram cerca de <b>{fmt(_mel_econ,0)} litros</b> em relação ao que a meta individual previa — o espelho da página anterior, que mede a perda. São os candidatos naturais a referência de condução: vale entender o que fazem de diferente (linha, carro, horário ou técnica) antes de tratar o desvio dos demais apenas como falta de empenho.</div></div>
    {_bloco_suspeitos(_susp_melhores, len(_mel), "Possível falso melhor — verificar sensor", "podem estar no topo por leitura do equipamento, e não por condução:")}
  </div>
  {footer()}
</div>""")

pages.append(f"""<div class="page-break"></div><div class="page">
  {page_header("Página 9 · Sinal de Alerta — Quem Caiu e Por Quê", f"Período: <b>{periodo_label}</b>", "Comparação", f"{MESANT_NOME} → {MESREF_NOME}")}
  <div class="grid-4" style="margin-bottom:6px;">
    <div class="metric"><div class="lbl">Motoristas em queda</div><div class="val" style="color:#dc2626;">{len(_al)}</div><div class="aux">maiores quedas do mês</div></div>
    <div class="metric"><div class="lbl">Maior queda</div><div class="val" style="color:#dc2626;">{pct(_al[0][3]) if _al else "—"}</div><div class="aux">{_al[0][0].title() if _al else "—"}</div></div>
    <div class="metric"><div class="lbl">Queda média</div><div class="val" style="color:#dc2626;">{pct(_al_queda_med)}</div><div class="aux">no recorte dos que caíram</div></div>
    <div class="metric" style="{'background:#fef2f2;border-color:#fecaca;' if _ca_comport else ''}"><div class="lbl" style="{'color:#dc2626;' if _ca_comport else ''}">Sem troca — condução</div><div class="val" style="{'color:#dc2626;' if _ca_comport else ''}">{len(_ca_comport)}</div><div class="aux">mesma linha e mesmo carro</div></div>
  </div>
  <div class="grid-38-62">
    <div class="card"><div class="card-title">Maior queda de KM/L no mês</div><div class="card-body">
      <div class="chart-wrap chart-wrap-tall"><img src="v3_alerta.png"/></div>
    </div></div>
    <div class="card"><div class="card-title">De quanto para quanto — e a queda foi por troca ou por condução?</div><div class="card-body">
      <table class="tbl-alerta"><thead><tr><th style="text-align:left;padding-left:8px;">Motorista</th><th>KM/L {MES3ANT}</th><th>KM/L {MES3REF}</th><th>Var.</th><th>Linha</th><th>Carro</th><th style="text-align:left;">Causa provável</th></tr></thead>
      <tbody>{rows_alerta_full}</tbody></table>
    </div></div>
  </div>
  <div class="grid-2">
    <div class="cons-box" style="margin-top:0;"><div class="cons-title">Leitura</div>
    <div class="cons-text">{_txt_alerta}</div></div>
    {_bloco_suspeitos(_susp_alerta, len(gfd.SINAL_ALERTA), "Possível falsa queda — verificar sensor", "podem ter caído por leitura do equipamento, e não por condução:")}
  </div>
  {footer()}
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

# Tambem eram dois assuntos numa pagina so: quem mais evoluiu (resultado) e quem esta
# sendo acompanhado agora (carteira em andamento). Viraram duas.
_dp = list(gfd.DESTAQUE_POSITIVO)
_susp_destaque = _suspeitos(_dp, +1, com_chapa=False)   # sensor a mais pode fabricar a alta
_dp_med = (sum(d[3] for d in _dp) / len(_dp)) if _dp else 0

# Mesma pergunta da pagina de queda, invertida: subiu porque mudou a conducao, ou porque
# pegou carro/linha melhor? Sem isso, a pagina sugere usar o motorista como referencia de
# conducao quando o ganho pode ter sido operacional.
_causa_dp = {str(c[0]).strip().upper(): c for c in gfd.DESTAQUE_POSITIVO_CAUSA}
rows_destaque_full = ""
for a in _dp:
    c = _causa_dp.get(str(a[0]).strip().upper())
    if c and c[5] is None:
        causa, cor = "Sem dado suficiente", "#64748b"
    elif c and (c[5] or c[6]):
        _q = ("linha e carro" if (c[5] and c[6]) else ("carro" if c[6] else "linha"))
        causa, cor = f"Trocou de {_q}", "#e0a800"
    elif c:
        causa, cor = "Sem troca — condução", "#16a34a"
    else:
        causa, cor = "—", "#64748b"
    _lin = _mudou(c[1], c[2]) if c else "—"
    _car = _mudou(c[3], c[4]) if c else "—"
    rows_destaque_full += (
        f"<tr><td style='text-align:left;padding-left:8px;white-space:nowrap;'>{a[0].title()}</td>"
        f"<td>{fmt(a[1],3)}</td><td style='font-weight:700;'>{fmt(a[2],3)}</td>"
        f"<td style='color:#16a34a;font-weight:800;'>{pct(a[3])}</td>"
        f"<td style='white-space:nowrap;'>{_lin}</td><td style='white-space:nowrap;'>{_car}</td>"
        f"<td style='text-align:left;color:{cor};font-weight:700;'>{causa}</td></tr>")

_dp_conducao = [c for c in gfd.DESTAQUE_POSITIVO_CAUSA
                if c[5] is not None and not c[5] and not c[6]]
if _dp_conducao:
    _txt_destaque = (
        f"São os motoristas que mais subiram de {MESANT_NOME} para {MESREF_NOME}. "
        f"<b>{len(_dp_conducao)} de {len(_dp)}</b> melhoraram mantendo a mesma linha e o "
        f"mesmo carro — nesses a evolução é atribuível à condução, e são os casos que "
        f"servem de referência para quem segue abaixo da meta. Nos demais, a alta veio "
        f"junto de troca de linha ou de veículo, então parte do ganho é operacional.")
else:
    _txt_destaque = (
        f"São os motoristas que mais subiram de {MESANT_NOME} para {MESREF_NOME}. Nenhum "
        f"deles manteve linha e carro no período, então a alta vem acompanhada de mudança "
        f"operacional — use com cautela como referência de condução.")

pages.append(f"""<div class="page-break"></div><div class="page">
  {page_header("Página 10 · Destaque Positivo — Quem Mais Evoluiu", f"Período: <b>{periodo_label}</b>", "Comparação", f"{MESANT_NOME} → {MESREF_NOME}")}
  <div class="grid-4" style="margin-bottom:6px;">
    <div class="metric"><div class="lbl">Motoristas em alta</div><div class="val" style="color:#16a34a;">{len(_dp)}</div><div class="aux">maior evolução no mês</div></div>
    <div class="metric"><div class="lbl">Maior evolução</div><div class="val" style="color:#16a34a;">{pct(_dp[0][3]) if _dp else "—"}</div><div class="aux">{_dp[0][0].title() if _dp else "—"}</div></div>
    <div class="metric"><div class="lbl">Evolução média</div><div class="val" style="color:#16a34a;">{pct(_dp_med)}</div><div class="aux">no recorte dos que subiram</div></div>
    <div class="metric" style="{'background:#f0fdf4;border-color:#bbf7d0;' if _dp_conducao else ''}"><div class="lbl" style="{'color:#15803d;' if _dp_conducao else ''}">Sem troca — condução</div><div class="val" style="{'color:#16a34a;' if _dp_conducao else ''}">{len(_dp_conducao)}</div><div class="aux">subiram na mesma linha e carro</div></div>
  </div>
  <div class="grid-38-62">
    <div class="card"><div class="card-title">Maior evolução de KM/L no mês</div><div class="card-body">
      <div class="chart-wrap chart-wrap-tall"><img src="v3_destaque.png"/></div>
    </div></div>
    <div class="card"><div class="card-title">De quanto para quanto — e a alta foi por troca ou por condução?</div><div class="card-body">
      <table class="tbl-alerta"><thead><tr><th style="text-align:left;padding-left:8px;">Motorista</th><th>KM/L {MES3ANT}</th><th>KM/L {MES3REF}</th><th>Var.</th><th>Linha</th><th>Carro</th><th style="text-align:left;">Causa provável</th></tr></thead>
      <tbody>{rows_destaque_full}</tbody></table>
    </div></div>
  </div>
  <div class="grid-2">
    <div class="cons-box" style="margin-top:0;"><div class="cons-title">Leitura</div>
    <div class="cons-text">{_txt_destaque}</div></div>
    {_bloco_suspeitos(_susp_destaque, len(_dp), "Possível falsa alta — verificar sensor", "podem ter subido por leitura do equipamento, e não por condução:")}
  </div>
  {footer()}
</div>""")

# A pagina propria de "Motoristas em Acompanhamento" foi eliminada: ela so listava a
# carteira, e as perguntas que ela levantava ja sao respondidas adiante (efetividade e
# desfechos na de Instrutores, antes/depois na de Evolucao Individual). A tabela desceu
# para o rodape da pagina de Instrutores, que e a dona do assunto.


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
    <div class="metric"><div class="lbl">Desfechos em {MESREF_NOME.lower()} — viraram tratativa</div><div class="val" style="color:#dc2626;">{sum(i['desf_ata'] for i in gfd.INSTRUTORES)}</div><div class="aux">viraram tratativa por não atingir a meta</div></div>
  </div>
  <div class="grid-2">
    <div class="card"><div class="card-title">Efetividade — % de acompanhados que atingiram a meta</div><div class="card-body">
      <div class="chart-wrap chart-wrap-tall"><img src="v3_instrutores_eficacia.png"/></div>
    </div></div>
    <div class="card"><div class="card-title">Carteira por status</div><div class="card-body">
      <div class="chart-wrap chart-wrap-tall"><img src="v3_instrutores_status.png"/></div>
    </div></div>
  </div>
  <div class="cons-box" style="margin-top:6px;"><div class="cons-title">Leitura analítica</div>
  <div class="cons-text">{_txt_instrutores}</div></div>
  {footer()}
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

# Resumo do ciclo em vez da lista nominal: a lista cresce a cada mes e vira ruido — quem
# lê quer a TAXA (quantos melhoraram, quantos fecharam na meta), não 40 nomes.
# COMPLETARAM_30_DIAS: (nome, chapa, instrutor, inicio, meta, real[, kml_inicial]).
_tem_inicial = bool(_c30) and len(_c30[0]) >= 7 and any(m[6] for m in _c30)
_melhoraram = [m for m in _c30 if _tem_inicial and m[6] and m[5] > m[6]]
_pioraram = [m for m in _c30 if _tem_inicial and m[6] and m[5] < m[6]]
_ganhos = [m[5] - m[6] for m in _c30 if _tem_inicial and m[6]]
_ganho_med = (sum(_ganhos) / len(_ganhos)) if _ganhos else 0
_tx_meta = (100 * len(_acima) / len(_c30)) if _c30 else 0
_tx_melhora = (100 * len(_melhoraram) / len(_ganhos)) if _ganhos else 0
# So os extremos vao para a tabela; o meio da distribuicao nao muda decisao.
_c30_ord = sorted((m for m in _c30 if _tem_inicial and m[6]), key=lambda m: -(m[5] - m[6]))
_c30_destaques = (_c30_ord[:3] + _c30_ord[-3:]) if len(_c30_ord) > 6 else _c30_ord
rows_c30_resumo = ""
for m in _c30_destaques:
    _ev = m[5] - m[6]
    _bate = m[5] >= m[4]
    rows_c30_resumo += (
        f"<tr><td style='text-align:left;padding-left:8px;white-space:nowrap;'>{m[0].title()}</td>"
        f"<td>{m[2].split()[0] if m[2] else '—'}</td><td>{m[3]}</td>"
        f"<td>{fmt(m[6],3)}</td><td style='font-weight:700;'>{fmt(m[5],3)}</td>"
        f"<td style='color:{'#16a34a' if _ev >= 0 else '#dc2626'};font-weight:800;'>"
        f"{'↑' if _ev >= 0 else '↓'} {fmt(abs(_ev),3)}</td>"
        f"<td style='color:{'#16a34a' if _bate else '#dc2626'};font-weight:700;'>"
        f"{'Na meta' if _bate else 'Abaixo'}</td></tr>")
# A leitura passa a falar do conjunto: com a lista crescendo, citar um nome nao representa
# o resultado do ciclo.
if not _c30:
    leitura_30dias = "Nenhum motorista completou o ciclo de 30 dias de acompanhamento nesta janela."
elif not _ganhos:
    leitura_30dias = (f"{len(_c30)} motoristas encerraram o ciclo de 30 dias: {len(_acima)} "
                      f"fecharam na meta e {len(_abaixo)} abaixo. Sem leitura inicial "
                      f"registrada, não é possível dizer quantos de fato melhoraram durante "
                      f"o acompanhamento.")
else:
    _dominante = ("a maior parte melhorou" if _tx_melhora >= 60 else
                  "pouco mais da metade melhorou" if _tx_melhora >= 50 else
                  "a maior parte NÃO melhorou")
    leitura_30dias = (
        f"Dos {len(_c30)} ciclos encerrados, {_dominante} ({len(_melhoraram)} de "
        f"{len(_ganhos)}), com ganho médio de {fmt(_ganho_med,3)} km/L. "
        f"{len(_acima)} terminaram na meta e {len(_abaixo)} abaixo"
        + (f" — estes são candidatos a nova tratativa, e não a simples encerramento."
           if _abaixo else ", o que permite encerrar e migrar o foco para novos casos.")
        + (f" Atenção aos {len(_pioraram)} que saíram piores do que entraram: neles o "
           f"acompanhamento não só deixou de resolver como coincidiu com piora."
           if _pioraram else ""))
pages.append(f"""<div class="page-break"></div><div class="page">
  {page_header("Página 13 · Evolução Individual e Fechamento de Ciclo (30 dias)", "Base: diesel_acompanhamentos + diesel_acompanhamento_sessoes", "Motoristas c/ 30 dias", str(len(gfd.COMPLETARAM_30_DIAS)))}
  <div class="grid-2">
    <div class="card"><div class="card-title">Antes x Depois — motoristas em acompanhamento</div><div class="card-body">
      <div class="chart-wrap chart-wrap-sm"><img src="v3_antes_depois.png"/></div>
    </div></div>
    <div class="card"><div class="card-title">Ciclos de 30 dias encerrados no período — resultado</div><div class="card-body">
      <div class="grid-2" style="margin-bottom:6px;">
        <div class="metric"><div class="lbl">Melhoraram o KM/L</div><div class="val" style="color:{'#16a34a' if _tx_melhora >= 50 else '#dc2626'};">{fmt(_tx_melhora,0)}%</div><div class="aux">{len(_melhoraram)} de {len(_ganhos)} com leitura inicial</div></div>
        <div class="metric"><div class="lbl">Fecharam na meta</div><div class="val" style="color:{'#16a34a' if _tx_meta >= 50 else '#dc2626'};">{fmt(_tx_meta,0)}%</div><div class="aux">{len(_acima)} de {len(_c30)} ciclos encerrados</div></div>
      </div>
      <div class="grid-2" style="margin-bottom:6px;">
        <div class="metric"><div class="lbl">Ganho médio no ciclo</div><div class="val" style="color:{'#16a34a' if _ganho_med >= 0 else '#dc2626'};">{'+' if _ganho_med >= 0 else ''}{fmt(_ganho_med,3)}</div><div class="aux">km/L entre início e fim</div></div>
        <div class="metric"><div class="lbl">Pioraram no ciclo</div><div class="val" style="color:{'#dc2626' if _pioraram else '#16a34a'};">{len(_pioraram)}</div><div class="aux">saíram piores do que entraram</div></div>
      </div>
      <table class="tbl-alerta"><thead><tr><th style="text-align:left;padding-left:8px;">{'Maiores evoluções e maiores quedas' if len(_c30_destaques) < len(_c30_ord) else 'Motorista'}</th><th>Instrutor</th><th>Início</th><th>KM/L ini.</th><th>KM/L fim</th><th>Evolução</th><th>Meta</th></tr></thead>
      <tbody>{rows_c30_resumo}</tbody></table>
      <div class="cons-box" style="margin-top:6px;"><div class="cons-title">Leitura</div>
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
# Ordenado pelo tamanho do efeito: com a lista liberada, os casos que importam
# (maior diferenca entre carro principal e demais) ficam no topo.
# Limite de exibicao: sem BCNT local a lista tinha 4 itens, mas no CI sao 31 e a pagina
# quebrava em duas. Mostra os de maior efeito; o restante entra na contagem do rodape.
_VEIC_MAX = 12
_veic_todos = sorted(gfd.VEICULO_30_DIAS, key=lambda x: -abs(x[5] - x[6]))
_veic_extra = max(0, len(_veic_todos) - _VEIC_MAX)
for v in _veic_todos[:_VEIC_MAX]:
    chapa, total_dias, carro, vezes, pctc, kml_c, kml_o, n_o = v
    nome = _veic_nome(chapa)
    diff = kml_c - kml_o
    cor = "#16a34a" if diff >= 0 else "#dc2626"
    interfere = ("Sim — carro ajuda" if diff > 0.05 else
             "Sim — carro atrapalha" if diff < -0.05 else
             "Não — é condução")
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
    # Diferenca NEGATIVA tambem e efeito do veiculo: o motorista rende menos justamente no
    # carro que mais usa, ou seja, o carro atrapalha. Antes isso era lido como
    # "comportamental", contradizendo a propria tabela ao lado, que dizia "carro atrapalha".
    # Comportamental e o caso em que o carro NAO faz diferenca (|diff| pequeno).
    if _diff > 0.05:
        _interp = "Indício de efeito positivo do veículo — o carro ajuda."
    elif _diff < -0.05:
        _interp = "Indício de efeito negativo do veículo — o carro atrapalha."
    else:
        _interp = "O carro não faz diferença: o resultado vem da condução."
    _sin = "a mais" if _diff >= 0 else "a menos"
    _boxes_veic += (f'<div class="cons-box" style="margin-top:0;"><div class="cons-title">{_nome}</div>'
                    f'<div class="cons-text" style="font-size:9.5px;">Carro {_carro} rende <b>{fmt(abs(_diff),3)} km/L</b> {_sin} '
                    f'que os outros que usou. {_interp}</div></div>')
if _veic:
    _vp = max(_veic, key=lambda v: v[5] - v[6]); _vn = min(_veic, key=lambda v: v[5] - v[6])
    _np = _veic_nome(_vp[0]); _dp = _vp[5] - _vp[6]
    _nn = _veic_nome(_vn[0]); _dn = _vn[5] - _vn[6]
    # Mesma correcao dos quadros: diferenca negativa e efeito do veiculo (o carro atrapalha),
    # nao fator comportamental. Comportamental e quando o carro nao muda o resultado.
    _n_efeito = sum(1 for v in _veic if abs(v[5] - v[6]) > 0.05)
    _n_neutro = len(_veic) - _n_efeito
    consid_p14 = (
        f"{_np} mostra a maior diferença positiva: +{fmt(_dp,3)} km/L no carro que mais usou "
        f"({_vp[2]}) frente aos demais — indício de que o veículo, e não só o motorista, "
        f"explica parte do resultado. No outro extremo, {_nn} rende {fmt(abs(_dn),3)} km/L "
        f"{'a mais' if _dn >= 0 else 'a menos'} no carro principal ({_vn[2]}), "
        f"{'outro caso de efeito do veículo' if abs(_dn) > 0.05 else 'diferença pequena, que aponta para condução'}. "
        f"No conjunto, <b>{_n_efeito} de {len(_veic)}</b> apresentam efeito atribuível ao "
        f"veículo e {_n_neutro} não — nestes, o resultado é de condução. "
        f"Vale cruzar os veículos de maior efeito com manutenção e idade da frota antes de "
        f"cobrar o motorista."
        + (f" A tabela mostra os {_VEIC_MAX} de maior efeito; outros {_veic_extra} "
           f"motoristas foram analisados e estão no conjunto acima." if _veic_extra else ""))
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

# Carros rodando sem leitura util de telemetria. A divergencia so ve carro com dado nas
# duas fontes, entao aparelho mudo era invisivel no relatorio inteiro - e e o caso mais
# grave, porque o KM/L desses carros simplesmente nao existe.
_COB_MAX = 6
_cob_todos = list(gfd.COBERTURA_TELEMETRIA)
_cob_extra = max(0, len(_cob_todos) - _COB_MAX)
_cob = _cob_todos[:_COB_MAX]
if _cob:
    _cob_rows = "".join(
        f"<tr><td style='font-weight:700;'>{c[0]}</td>"
        f"<td>{c[1]:,}</td>".replace(",", ".")
        + f"<td>{c[2]}</td><td>{c[3]}</td><td>{c[4]}</td>"
        f"<td style='color:{'#dc2626' if c[5] < 50 else '#e0a800'};font-weight:800;'>{fmt(c[5],0)}%</td>"
        f"<td style='text-align:left;color:{'#dc2626' if c[3] == 0 else '#e0a800'};font-weight:700;'>{c[6]}</td></tr>"
        for c in _cob)
    _km_sem = sum(c[1] for c in _cob)
    _mudos = [c for c in _cob if c[3] == 0]
    _bloco_cobertura = f'''<div class="card" style="margin-top:6px;"><div class="card-title">Carros rodando sem leitura confiável de telemetria — {len(_cob_todos)} veículos{f" (mostrando os {_COB_MAX} piores)" if _cob_extra else ""}</div><div class="card-body">
    <table class="tbl-alerta"><thead><tr><th>Carro</th><th>KM no Transnet</th><th>Dias rodados</th><th>Dias c/ leitura</th><th>Dias c/ leitura inválida</th><th>Cobertura</th><th style="text-align:left;">Diagnóstico</th></tr></thead>
    <tbody>{_cob_rows}</tbody></table>
    <div class="cons-box" style="margin-top:6px;"><div class="cons-title">Por que isto importa</div>
    <div class="cons-text">Estes veículos rodaram <b>{_km_sem:,} km</b> no Transnet sem que a telemetria registrasse leitura útil — {len(_mudos)} deles não reportaram nada. Como o ranking de motoristas, a meritocracia e o acompanhamento usam o KM/L da telemetria, quem dirigiu estes carros pode estar fora das análises ou com número incompleto. A divergência acima só enxerga carros com dado nas duas fontes; estes não apareceriam em lugar nenhum. Prioridade de checagem física igual à dos carros com sensor divergente.</div></div>
  </div></div>'''.replace(",", ".")
else:
    _bloco_cobertura = ""

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
  {_bloco_cobertura}
  {footer()}
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
      <div class="cons-text">{len(_visita_label)} visitas noturnas programadas para {MESREF_NOME.lower()} — {_visitas_datas} — mantendo a cadência mensal de visitas noturnas. Cada visita inclui verificação de manobras no pátio, orientação aos motoristas em campo e reforço das boas práticas de condução econômica.</div></div>
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

# ================= INDICE (montado a partir das paginas ja geradas) =================
# Le o H1 e o "Página N" de cada pagina em vez de manter uma lista a parte: assim o indice
# nao tem como divergir dos titulos reais quando alguem renomear ou reordenar uma pagina.
_idx = sorted(INDICE)

_GRUPOS = [
    (2, 6, "Frota e linhas", "Como a frota consome e onde o desperdício se concentra"),
    (7, 9, "Motoristas", "Quem está distante da meta, quem evoluiu e quem está sob acompanhamento"),
    (10, 12, "Tratativas e instrutores", "Ação formal aberta e uso do tempo dos instrutores"),
    (13, 16, "Efeito e verificação", "Se o acompanhamento surtiu efeito e a confiabilidade do dado"),
    (17, 19, "Campo e plano", "Presença noturna, comunicação com o motorista e o que fazer na semana"),
]
_MINUSC = {"de", "da", "do", "das", "dos", "e", "em", "por", "com", "no", "na", "a", "o"}


def _cap_titulo(t):
    """Capitaliza sem estragar sigla nem preposicao: .title() dava 'Km/L ... Da Meta'."""
    saida = []
    for i, w in enumerate(t.split()):
        limpo = w.strip("()—·")
        if not limpo:
            saida.append(w)
        elif limpo.upper() == limpo and any(c.isalpha() for c in limpo):
            saida.append(w)                      # sigla ja em caixa alta: KM/L, ATA, DPF
        elif i > 0 and limpo.lower() in _MINUSC:
            saida.append(w.lower())
        else:
            # Maiuscula na primeira LETRA, nao no caractere 0: com "(Transnet" o caractere 0
            # e o parentese e o resultado saia "(transnet".
            j = next((k for k, c in enumerate(w) if c.isalpha()), None)
            saida.append(w if j is None else w[:j] + w[j].upper() + w[j + 1:].lower())
    return " ".join(saida)


_idx_html = ""
for _ini, _fim, _titulo, _desc in _GRUPOS:
    _itens = [(n, t) for n, t in _idx if _ini <= n <= _fim]
    if not _itens:
        continue
    _linhas = "".join(
        f'<div style="display:flex;gap:9px;align-items:baseline;padding:3.5px 0;'
        f'border-bottom:1px solid #eef2f7;">'
        f'<span style="font-size:12px;font-weight:800;color:#0e7c7b;min-width:22px;">{n:02d}</span>'
        f'<span style="font-size:10px;color:#0f172a;">{_cap_titulo(t)}</span></div>'
        for n, t in _itens)
    _idx_html += (
        f'<div class="card" style="margin-bottom:7px;">'
        f'<div class="card-title">{_titulo} · páginas {_itens[0][0]} a {_itens[-1][0]}</div>'
        f'<div class="card-body" style="padding:5px 12px;">'
        f'<div style="font-size:8.4px;color:#64748b;margin-bottom:3px;">{_desc}</div>'
        f'{_linhas}</div></div>')

_meio = (len(_GRUPOS) + 1) // 2
_idx_partes = _idx_html.split('<div class="card" style="margin-bottom:7px;">')[1:]
_idx_cards = ['<div class="card" style="margin-bottom:7px;">' + c for c in _idx_partes]

pages.insert(1, f"""<div class="page-break"></div><div class="page">
  {page_header("Índice do relatório", f"Condução Econômica · Flash Report Diesel · {MESREF} — {len(_idx)} páginas de conteúdo", "Período analisado", PERIODO, numerar=False)}
  <div class="grid-2" style="align-items:start;">
    <div>{''.join(_idx_cards[:_meio])}</div>
    <div>{''.join(_idx_cards[_meio:])}
      <div class="cons-box" style="margin-top:0;"><div class="cons-title">Como ler este relatório</div>
      <div class="cons-text">O relatório analisa o mês corrente do dia 01 até a véspera da geração, sempre comparando com o mês anterior fechado. O KM/L oficial vem do Transnet; a Telemetria entra como fonte de comparação, e divergências entre as duas são tratadas na página 16. Uma faixa vermelha na capa indica que alguma página não conseguiu carregar dado atualizado.</div></div>
    </div>
  </div>
</div>""")

html = f"""<!DOCTYPE html><html lang="pt-BR"><head><meta charset="UTF-8"/><title>Flash Report Diesel v3</title>
<style>{CSS}</style></head><body>
{''.join(pages)}
</body></html>"""

# Aviso de transbordo: cada .page tem altura fixa e o weasyprint quebra em duas quando o
# conteudo passa. Com dado ao vivo as tabelas crescem e isso aconteceu sem ninguem notar -
# o PDF saiu com 23 paginas em vez de 21. Compara o previsto com o gerado no fim.
print(f"[layout] {_NUM[0]} paginas numeradas + capa + indice = {_NUM[0] + 1} esperadas no PDF.")
html = html.replace("@@TOTAL@@", str(_NUM[0]))
(OUT / "flash_report_diesel_v3.html").write_text(html, encoding="utf-8")
print("HTML v3 gerado.")
