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
# No fechamento o mes analisado ja acabou - dizer "mes corrente ate a vespera" seria mentira.
_COMO_LER_JANELA = (
    f"Este é o fechamento de {MESREF}: o relatório cobre o mês inteiro ({PERIODO}), "
    f"comparado com {MESANT}."
    if getattr(gfd, "MES_FECHADO", False) else
    "O relatório analisa o mês corrente do dia 01 até a véspera da geração, sempre "
    "comparando com o mês anterior fechado.")

TOTAL_PAGINAS = 19

# Faixa vermelha na capa quando algum bloco caiu no fallback fixo (mes errado silencioso).
_aviso = getattr(gfd, "AVISO_FALLBACK", "")
AVISO_HTML = (f"""<div style="margin-top:16px; max-width:640px; font-size:12px; font-weight:800;
  background:#7f1d1d; border:2px solid #fca5a5; color:#fff; padding:10px 20px; border-radius:10px;">
  &#9888; {_aviso}</div>""" if _aviso else "")

CSS = """
* { box-sizing: border-box; }
body { margin:0; font-family: Arial, Helvetica, sans-serif; background:#EAF4F2; color:#1F2D2B; }
.page { width:297mm; height:204mm; overflow:hidden; margin:0 auto; background:#ffffff; padding:0 10mm 8mm 10mm; position:relative; }
.page-break { page-break-before: always; }
/* Faixa do padrao RGI: barra verde-escura sangrando ate as bordas da folha, com o fio
   mint no topo. As margens laterais negativas anulam o padding da .page, e o padding-top
   da .page foi zerado para a barra encostar no topo - por isso ela nao "flutua". */
.header { display:flex; justify-content:space-between; align-items:center;
  background:#0A5A50; border-top:3px solid #49B8A5;
  margin:0 -10mm 8px -10mm; padding:7px 10mm 8px 10mm; }
.title { padding-right:12px; }
.title h1 { margin:0; font-size:19px; line-height:1.12; color:#ffffff; font-style:italic; letter-spacing:.2px; }
.title .sub { margin-top:3px; font-size:9.5px; color:#9FD8CE; }
.period-box { min-width:190px; text-align:right; background:rgba(255,255,255,.13); border:1px solid rgba(159,216,206,.5); color:#ffffff; padding:6px 12px; border-radius:10px; }
.period-box .ref { font-size:8.5px; text-transform:uppercase; font-weight:700; color:#9FD8CE; }
.period-box .val { font-size:14px; font-weight:800; margin-top:2px; }
.csc-mark { font-size:19px; font-weight:800; font-style:italic; color:#ffffff; letter-spacing:.5px; margin-left:13px; white-space:nowrap; }
.grid-2 { display:grid; grid-template-columns:1fr 1fr; gap:10px; margin-bottom:8px; }
.grid-38-62 { display:grid; grid-template-columns:38fr 62fr; gap:10px; margin-bottom:8px; }
.tbl-alerta td, .tbl-alerta th { padding:4px 5px; font-size:8.2px; }
.tbl-alerta th { font-size:7.4px; }
.grid-3 { display:grid; grid-template-columns:1fr 1fr 1fr; gap:10px; margin-bottom:8px; }
.grid-4 { display:grid; grid-template-columns:1fr 1fr 1fr 1fr; gap:10px; margin-bottom:8px; }
.card { border:1px solid #CFE4DF; border-radius:12px; overflow:hidden; background:#fff; }
.card-title { padding:6px 12px; background:#0A5A50; color:white; font-size:9.5px; font-weight:800; text-transform:uppercase; letter-spacing:.5px; }
.card-body { padding:8px 10px; }
table { width:100%; border-collapse:collapse; font-size:8.4px; }
th { background:#EAF4F2; color:#0A5A50; text-transform:uppercase; font-size:7.4px; padding:3px 4px; border:1px solid #CFE4DF; text-align:center; }
td { padding:3px 4px; border:1px solid #CFE4DF; text-align:center; }
.tbl-compact td, .tbl-compact th { padding:2px 4px; font-size:7.6px; }
.tbl-big td, .tbl-big th { padding:7px 8px; font-size:10.5px; }
.tbl-big th { font-size:9px; }
.chart-wrap-md img { max-height:68mm; width:auto; max-width:100%; }
.metric { border:1px solid #CFE4DF; border-radius:10px; padding:7px; background:#EAF4F2; text-align:center; }
.metric .lbl { font-size:8px; color:#6B7C79; text-transform:uppercase; font-weight:800; }
.metric .val { margin-top:2px; font-size:15px; font-weight:800; color:#1F2D2B; }
.metric .aux { margin-top:2px; font-size:7.5px; color:#6B7C79; }
.chart-wrap { padding:6px; border:1px solid #CFE4DF; border-radius:12px; background:#fff; text-align:center; }
/* max-height e trava de seguranca: um PNG com proporcao inesperada (ja aconteceu com o
   cluster, que virou quase quadrado) empurrava a pagina inteira para a folha seguinte.
   O maior grafico legitimo desta classe ocupa ~134mm, entao 140mm nao mexe em nenhum. */
.chart-wrap img { max-width:100%; max-height:140mm; width:auto; height:auto; }
.chart-wrap-sm img { max-height:78mm; width:auto; max-width:100%; }
.chart-wrap-tall img { max-height:88mm; width:auto; max-width:100%; }
/* grafico de diagnostico: largura cheia da folha, altura travada para caber
   as duas tabelas e o texto embaixo sem empurrar nada para a pagina seguinte. */
.chart-wrap-diag img { width:100%; max-width:100%; max-height:70mm; height:auto; }
/* KM/L do ano: o grafico e o assunto da pagina, entao ocupa a folha toda. */
.chart-wrap-xl img { width:100%; max-width:100%; max-height:118mm; height:auto; }
.cons-box { margin-top:6px; border:1px solid #CFE4DF; border-radius:12px; background:#EAF4F2; padding:6px 12px; }
.cons-title { font-size:8.5px; font-weight:800; text-transform:uppercase; margin-bottom:3px; color:#0A5A50; }
.cons-text { font-size:9px; line-height:1.32; color:#1F2D2B; text-align:justify; }
.footer { position:absolute; left:10mm; right:10mm; bottom:3mm; font-size:7.5px; color:#6B7C79; display:flex; justify-content:space-between; border-top:1px solid #CFE4DF; padding-top:3px; }
.warn { background:#fef9c3; border:1px solid #eab308; color:#854d0e; border-radius:10px; padding:6px 12px; font-size:9px; margin-bottom:6px; }
.badge-oficial { display:inline-block; background:#0E7C6E; color:white; font-size:8px; font-weight:800; padding:2px 8px; border-radius:999px; margin-left:6px; }
.placeholder { border:2px dashed #9AAEAA; border-radius:12px; padding:20px; text-align:center; color:#6B7C79; background:#EAF4F2; }
.placeholder b { color:#1F2D2B; }
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
    <div class="csc-mark">CSC</div>
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
    <div class="csc-mark">CSC</div>
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
_dias_cols = ["Dom","Seg","Ter","Qua","Qui","Sex","Sáb"]
_visita_label = {14: "1ª visita", 28: "2ª visita"}
_cal_header = "".join(f'<div style="text-align:center;font-size:8px;font-weight:800;color:#6B7C79;text-transform:uppercase;padding:4px 0;">{d}</div>' for d in _dias_cols)
# Celula alta: a pagina 17 tem so o calendario e o card da visita, e com celula baixa
# sobrava mais de um terco da folha em branco (fica gritante quando a visita nao teve
# fotos). A altura da celula e o que faz os dois cards preencherem a pagina.
_CAL_CELULA = "min-height:52px;display:flex;flex-direction:column;justify-content:center;"
_cal_cells = ""
for _week in _weeks_jul:
    for _day in _week:
        if _day == 0:
            _cal_cells += '<div></div>'
        elif _day in _visita_label:
            _cal_cells += (f'<div style="border-radius:8px;background:#0E7C6E;color:#fff;padding:5px 3px;text-align:center;{_CAL_CELULA}">'
                           f'<div style="font-size:16px;font-weight:800;">{_day}</div>'
                           f'<div style="font-size:7px;font-weight:700;margin-top:1px;">{_visita_label[_day]}</div></div>')
        else:
            _cal_cells += (f'<div style="border:1px solid #e2e8f0;border-radius:8px;padding:5px 3px;text-align:center;color:#3A4A47;{_CAL_CELULA}">'
                           f'<div style="font-size:13px;font-weight:600;">{_day}</div></div>')
_visitas_datas = ", ".join(f"{d:02d}/{gfd.MES_REF_MM:02d}" for d in sorted(_visita_label))
CAL_JULHO_HEADER = _cal_header
CAL_JULHO_CELLS = _cal_cells


# ================= PAGINA 0: CAPA =================
pages.append(f"""<div class="page" style="background:linear-gradient(135deg,#0A5A50 0%,#0E7C6E 100%); color:white; display:flex; flex-direction:column; justify-content:center; align-items:center; text-align:center; padding:0;">
  <div style="position:absolute; top:0; left:0; right:0; height:3px; background:#49B8A5;"></div>
  <svg width="150" height="90" viewBox="0 0 200 120" style="margin-bottom:10px;">
    <rect x="8" y="28" width="184" height="62" rx="14" fill="#ffffff" opacity="0.95"/>
    <rect x="8" y="28" width="184" height="20" rx="10" fill="#9FD8CE"/>
    <rect x="20" y="52" width="26" height="20" rx="3" fill="#0E7C6E"/>
    <rect x="52" y="52" width="26" height="20" rx="3" fill="#0E7C6E"/>
    <rect x="84" y="52" width="26" height="20" rx="3" fill="#0E7C6E"/>
    <rect x="116" y="52" width="26" height="20" rx="3" fill="#0E7C6E"/>
    <rect x="148" y="52" width="30" height="20" rx="3" fill="#0A5A50"/>
    <rect x="8" y="76" width="184" height="8" fill="#0A5A50"/>
    <circle cx="42" cy="98" r="13" fill="#0A5A50"/>
    <circle cx="42" cy="98" r="5.5" fill="#cbd5e1"/>
    <circle cx="158" cy="98" r="13" fill="#0A5A50"/>
    <circle cx="158" cy="98" r="5.5" fill="#cbd5e1"/>
    <rect x="8" y="28" width="184" height="62" rx="14" fill="none" stroke="#0E7C6E" stroke-width="2"/>
  </svg>
  <div style="font-size:13px; letter-spacing:4px; font-weight:700; opacity:.8; margin-bottom:14px;">GRUPO CSC · EXPRESSO PLANALTO S/A</div>
  <div style="font-size:40px; font-weight:900; letter-spacing:1px;">CONDUÇÃO ECONÔMICA</div>
  <div style="font-size:22px; font-weight:700; margin-top:6px; color:#9FD8CE;">FLASH REPORT DIESEL</div>
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
# O grafico do ano dividia a folha com o resumo executivo e o grafico semanal, e saia com
# ~1/4 da largura util - ilegivel na TV da garagem. Vira o assunto da pagina: os numeros
# do resumo viram uma faixa de cards no topo e o grafico ocupa a folha inteira. O semanal
# ganhou pagina propria logo abaixo, no mesmo formato.
_melhor_mes = max(gfd.KML_HISTORICO, key=lambda m: m[1])
pages.append(f"""<div class="page-break"></div><div class="page">
  {page_header(f"Página 2 · KM/L Mensal — Histórico de {len(gfd.KML_HISTORICO)} Meses (Transnet oficial)", f"Período: <b>{periodo_label}</b>", "Mês de referência", MESREF)}
  <div class="grid-4" style="margin-bottom:8px;">
    <div class="metric"><div class="lbl">KM/L {MESREF_NOME} (Transnet)<span class="badge-oficial">OFICIAL</span></div><div class="val">{fmt(gfd.KML_HISTORICO[-1][1],3)}</div><div class="aux">vs {fmt(gfd.KML_HISTORICO[-2][1],3)} em {MESANT_NOME.lower()} ({pct(var_jun)})</div></div>
    <div class="metric"><div class="lbl">KM/L {MESREF_NOME} (Telemetria)</div><div class="val">{_telem_txt}</div><div class="aux">{"Fonte de comparação" if _telem_val else "sem leitura de telemetria no mês"}</div></div>
    <div class="metric"><div class="lbl">Meta operacional</div><div class="val">{fmt(gfd.META,2)} km/L</div><div class="aux">referência do mês</div></div>
    <div class="metric"><div class="lbl">Melhor mês do histórico</div><div class="val">{_melhor_mes[0]}</div><div class="aux">{fmt(_melhor_mes[1],3)} km/L</div></div>
  </div>
  <div class="card"><div class="card-title">Evolução Mensal — Transnet (oficial)</div><div class="card-body" style="padding:6px 8px;">
    <div class="chart-wrap chart-wrap-xl" style="border:none;padding:0;"><img src="v3_historico.png"/></div>
  </div></div>
  <div class="cons-box"><div class="cons-title">Considerações</div>
  <div class="cons-text">{_txt_p2}</div></div>
  {footer(2)}
</div>""")

# ---- Pagina propria para a variacao semanal, no mesmo formato grande ----
_sem_ult = gfd.KML_SEMANAL[-1] if gfd.KML_SEMANAL else None
_sem_melhor = max(gfd.KML_SEMANAL, key=lambda s: s[1]) if gfd.KML_SEMANAL else None
_sem_pior = min(gfd.KML_SEMANAL, key=lambda s: s[1]) if gfd.KML_SEMANAL else None
_txt_sem = (f"Nas últimas {len(gfd.KML_SEMANAL)} semanas o KM/L oscilou entre "
            f"{fmt(_sem_pior[1],3)} ({_sem_pior[0]}) e {fmt(_sem_melhor[1],3)} ({_sem_melhor[0]}). "
            f"A variação semana a semana vem {_tend}. "
            f"A semana mais recente ({_sem_ult[0]}) fechou em {fmt(_sem_ult[1],3)} km/L."
            if gfd.KML_SEMANAL else "Sem semanas suficientes no período.")
pages.append(f"""<div class="page-break"></div><div class="page">
  {page_header("Evolução da Variação Semanal (%) — Transnet", f"Período: <b>{periodo_label}</b> · semanas de segunda a domingo", "Semanas no gráfico", str(len(gfd.KML_SEMANAL)))}
  <div class="card" style="margin-bottom:8px;"><div class="card-title">Variação Semanal (%) e KM/L da Semana — Transnet</div><div class="card-body" style="padding:6px 8px;">
    <div class="chart-wrap chart-wrap-xl" style="border:none;padding:0;"><img src="v3_semanal_pct.png"/></div>
  </div></div>
  <div class="cons-box"><div class="cons-title">Considerações</div>
  <div class="cons-text">{_txt_sem}</div></div>
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

# ============ PAGINA DEDICADA: DIAGNOSTICO DO CLUSTER (por que variou) ============
# A primeira versao respondia "trocou de linha?" com uma decomposicao mix x desempenho.
# Estava certa, mas ninguem le um relatorio para descobrir que "o mix explica -0,001": a
# pergunta e POR QUE caiu. A premiacao_diaria traz litros_ideais - o consumo que a viagem
# deveria ter tido nas condicoes dela - e em litros/100km vale real = ideal + excesso.
# Entao da para dizer, em portugues, se a operacao ficou mais pesada ou se andaram pior,
# e quanto isso custou EM LITROS. O mix x desempenho vira uma linha de rodape.
_ac = gfd.ANALISE_CLUSTER
if _ac:
    _CL = _ac["cluster"]
    _c = _ac.get("causa")
    _d_lin, _d_mot = _ac["dims"]["linha"], _ac["dims"]["motorista"]
    _piorou = _ac["delta"] < 0
    _cor_var = "#c0392b" if _piorou else "#1e7a34"

    def _sinal(v, casas=3):
        return ("+" if v >= 0 else "−") + fmt(abs(v), casas)

    def _mil(v):
        return fmt(v / 1000, 1) + " mil"

    def _tab_causa(itens, e_motorista, n=6):
        """Piores primeiro; a lista ja vem filtrada por km minimo nos dois meses."""
        out = ""
        for i in itens[:n]:
            nome = i["nome"][:28].title() if e_motorista else i["nome"]
            cor = "#c0392b" if i["litros_extra"] > 0 else "#1e7a34"
            extra = ("+" if i["litros_extra"] > 0 else "−") + str(abs(i["litros_extra"]))
            out += ("<tr>"
                    f"<td style='text-align:left;padding-left:7px;font-weight:700;'>{nome}</td>"
                    f"<td>{_mil(i['km_ref'])}</td>"
                    f"<td>{fmt(i['kml_ant'],3)} &rarr; <b>{fmt(i['kml_ref'],3)}</b></td>"
                    f"<td>{fmt(i['exc_ant'],1)} &rarr; <b>{fmt(i['exc_ref'],1)}</b></td>"
                    f"<td style='color:{cor};font-weight:800;'>{extra} L</td>"
                    "</tr>")
        return out or "<tr><td colspan='5' style='color:#6B7C79;'>Sem registros com quilometragem suficiente nos dois meses.</td></tr>"

    _cab_causa = ("<thead><tr><th style='text-align:left;padding-left:7px;'>{rot}</th>"
                  f"<th>Km rodado</th><th>KM/L {MES3ANT}&rarr;{MES3REF}</th>"
                  "<th>Desperdício<br/>L/100km</th><th>Litros a mais<br/>no mês</th></tr></thead>")

    if _c:
        _rota, _cond = _c["efeito_rota"], _c["efeito_conducao"]
        _manda = "conducao" if abs(_cond) >= abs(_rota) else "rota"
        # Velocidade media e a peca que o consumo ideal NAO enxerga: a base calcula o
        # ideal pela rota, nao pelo transito do dia. Se a velocidade caiu, uma parte do
        # "desperdicio" e motor parado em congestionamento, e nao tecnica de conducao -
        # e a acao muda completamente (falar com a operacao, nao com o motorista). Por
        # isso a queda de velocidade entra como ressalva no veredito, nao como rodape.
        _vel_var = None
        if _c["vel_ant"] and _c["vel_ref"]:
            _vel_var = 100 * (_c["vel_ref"] - _c["vel_ant"]) / _c["vel_ant"]
        _vel_caiu = _vel_var is not None and _vel_var <= -2.0
        _vel_txt = ""
        if _vel_var is not None and not _vel_caiu:
            _vel_txt = (f" A velocidade média ficou em {fmt(_c['vel_ref'],1)} km/h "
                        f"(era {fmt(_c['vel_ant'],1)}), então não foi trânsito."
                        if abs(_vel_var) < 2.0 else
                        f" A velocidade média subiu de {fmt(_c['vel_ant'],1)} para "
                        f"{fmt(_c['vel_ref'],1)} km/h, o que costuma ajudar o consumo.")
        if _manda == "conducao" and _cond < 0:
            _veredito = (f"O consumo que as rotas do {_CL} pediam ficou praticamente igual "
                         f"({fmt(_c['ideal_ant'],2)} &rarr; {fmt(_c['ideal_ref'],2)} L/100km), "
                         f"mas o que se gastou acima disso subiu de {fmt(_c['exc_ant'],2)} para "
                         f"{fmt(_c['exc_ref'],2)} L/100km — na quilometragem do mês, "
                         f"<b>{abs(_c['litros_extra'])} litros queimados a mais</b> do que se o "
                         f"cluster tivesse mantido o desperdício de {MESANT_NOME.lower()}.")
            if _vel_caiu:
                _veredito = (
                    f"<b>Sobrou consumo, mas o trânsito também piorou — não dá para cobrar "
                    f"só o motorista.</b> " + _veredito +
                    f" <b>Atenção:</b> a velocidade média caiu de {fmt(_c['vel_ant'],1)} para "
                    f"{fmt(_c['vel_ref'],1)} km/h ({pct(_vel_var)}), e o consumo ideal é "
                    f"calculado pela rota, sem levar trânsito em conta. Boa parte desses "
                    f"{abs(_c['litros_extra'])} litros pode ser motor parado em "
                    f"congestionamento, não técnica de condução. Antes de tratar como "
                    f"comportamento, vale conferir o que aconteceu com o tempo de viagem "
                    f"das linhas do {_CL} no período.")
            else:
                _veredito = (f"<b>A operação não ficou mais pesada — quem piorou foi a "
                             f"condução.</b> " + _veredito + _vel_txt)
        elif _manda == "rota" and _rota < 0:
            _veredito = (f"<b>A operação ficou mais pesada.</b> O consumo que as próprias rotas do "
                         f"{_CL} pediam subiu de {fmt(_c['ideal_ant'],2)} para {fmt(_c['ideal_ref'],2)} "
                         f"L/100km — isso não é condução, é a operação (trânsito, itinerário, carga). "
                         f"O desperdício sobre o ideal ficou em {fmt(_c['exc_ref'],2)} L/100km "
                         f"(era {fmt(_c['exc_ant'],2)}).{_vel_txt}"
                         + (f" A velocidade média caiu de {fmt(_c['vel_ant'],1)} para "
                            f"{fmt(_c['vel_ref'],1)} km/h ({pct(_vel_var)}), reforçando a "
                            f"leitura de operação." if _vel_caiu else ""))
        else:
            _veredito = (f"O consumo ideal das rotas foi de {fmt(_c['ideal_ant'],2)} para "
                         f"{fmt(_c['ideal_ref'],2)} L/100km e o desperdício sobre ele de "
                         f"{fmt(_c['exc_ant'],2)} para {fmt(_c['exc_ref'],2)} L/100km, "
                         f"o que dá {_sinal(_rota)} km/L de operação e {_sinal(_cond)} km/L "
                         f"de condução.{_vel_txt}"
                         + (f" A velocidade média caiu {pct(_vel_var)}, e o consumo ideal "
                            f"não leva trânsito em conta." if _vel_caiu else ""))
        _bloco = f"""
  <div class="cons-box" style="margin:0 0 7px 0;border-left:5px solid {_cor_var};">
    <div class="cons-title">Por que o {_CL} {'caiu' if _piorou else 'subiu'}</div>
    <div class="cons-text" style="font-size:10.2px;line-height:1.4;">{_veredito}</div></div>
  <div class="card" style="margin-bottom:7px;"><div class="card-title">Da {'queda' if _piorou else 'alta'} de {fmt(abs(_ac['delta']),3)} km/L, quanto veio de cada coisa</div><div class="card-body" style="padding:4px 8px;">
    <div class="chart-wrap chart-wrap-diag" style="border:none;padding:0;"><img src="v3_cluster_cascata.png"/></div>
  </div></div>
  <div class="grid-2">
    <div class="card"><div class="card-title">Carros que mais desperdiçaram (mín. 500 km nos dois meses)</div><div class="card-body" style="padding:5px 7px;">
      <table class="tbl-compact">{_cab_causa.format(rot="Carro")}<tbody>{_tab_causa(_c['carros'], False)}</tbody></table>
    </div></div>
    <div class="card"><div class="card-title">Motoristas que mais desperdiçaram (mín. 500 km nos dois meses)</div><div class="card-body" style="padding:5px 7px;">
      <table class="tbl-compact">{_cab_causa.format(rot="Motorista")}<tbody>{_tab_causa(_c['motoristas'], True)}</tbody></table>
    </div></div>
  </div>"""
        _kpis = f"""
    <div class="metric"><div class="lbl">KM/L do {_CL}</div><div class="val" style="color:{_cor_var};font-size:13px;">{fmt(_ac['kml_ant'],3)} &rarr; {fmt(_ac['kml_ref'],3)}</div><div class="aux">{pct(_ac['var_pct'])} vs {MESANT_NOME.lower()}, mesma janela</div></div>
    <div class="metric"><div class="lbl">Litros queimados a mais</div><div class="val" style="color:{_cor_var};">{abs(_c['litros_extra'])} L</div><div class="aux">além do desperdício de {MESANT_NOME.lower()}</div></div>
    <div class="metric"><div class="lbl">Consumo que a rota pedia</div><div class="val" style="font-size:13px;">{fmt(_c['ideal_ant'],2)} &rarr; {fmt(_c['ideal_ref'],2)}</div><div class="aux">L/100km — dificuldade da operação</div></div>
    <div class="metric"><div class="lbl">Desperdício sobre o ideal</div><div class="val" style="font-size:13px;">{fmt(_c['exc_ant'],2)} &rarr; {fmt(_c['exc_ref'],2)}</div><div class="aux">L/100km — o que depende da condução</div></div>"""
    else:
        _bloco = f"""
  <div class="cons-box" style="margin:0 0 7px 0;"><div class="cons-title">Sem litros ideais no período</div>
  <div class="cons-text">A base não trouxe <i>litros_ideais</i> para o {_CL} nos dois meses, então não dá para separar operação de condução. Fica só a leitura de composição.</div></div>
  <div class="card"><div class="card-title">Composição — mix (quem rodou o km) × desempenho</div><div class="card-body" style="padding:4px 8px;">
    <div class="chart-wrap chart-wrap-diag" style="border:none;padding:0;"><img src="v3_cluster_diag.png"/></div>
  </div></div>"""
        _kpis = f"""
    <div class="metric"><div class="lbl">KM/L do {_CL}</div><div class="val" style="color:{_cor_var};font-size:13px;">{fmt(_ac['kml_ant'],3)} &rarr; {fmt(_ac['kml_ref'],3)}</div><div class="aux">{pct(_ac['var_pct'])} vs {MESANT_NOME.lower()}</div></div>
    <div class="metric"><div class="lbl">Km rodado</div><div class="val">{_mil(_ac['km_ref'])}</div><div class="aux">era {_mil(_ac['km_ant'])}</div></div>
    <div class="metric"><div class="lbl">Frota</div><div class="val">{_ac['n_veic_ref']} carros</div><div class="aux">era {_ac['n_veic_ant']}</div></div>
    <div class="metric"><div class="lbl">Motoristas</div><div class="val">{_ac['n_mot_ref']}</div><div class="aux">era {_ac['n_mot_ant']}</div></div>"""

    # Rodape: a pergunta "trocou de linha?" respondida em uma frase, sem tomar a pagina.
    _trocou = abs(_d_lin["mix"]) > abs(_d_lin["desemp"])
    _trocou_mot = abs(_d_mot["mix"]) > abs(_d_mot["desemp"])
    _entraram = [i["nome"] for i in _d_lin["itens"] if i["entrou"]][:3]
    _sairam = [i["nome"] for i in _d_lin["itens"] if i["saiu"]][:3]
    _rod = ("<b>Trocou de linha?</b> "
            + (f"Sim — a mudança no conjunto de linhas responde por {_sinal(_d_lin['mix'])} km/L, "
               f"mais que o desempenho dentro delas ({_sinal(_d_lin['desemp'])})."
               if _trocou else
               f"Não — o mix de linhas responde por apenas {_sinal(_d_lin['mix'])} km/L; o peso "
               f"está no desempenho dentro das mesmas linhas ({_sinal(_d_lin['desemp'])}).")
            + " <b>Trocou de motorista?</b> "
            + (f"Sim — a troca responde por {_sinal(_d_mot['mix'])} km/L."
               if _trocou_mot else
               f"Não — a troca responde por {_sinal(_d_mot['mix'])} km/L, contra "
               f"{_sinal(_d_mot['desemp'])} dos mesmos motoristas."))
    if _entraram:
        _rod += f" Linhas que entraram: {', '.join(_entraram)}."
    if _sairam:
        _rod += f" Saíram: {', '.join(_sairam)}."
    if _ac.get("kml_ref_oficial"):
        _rod += (f" KM/L oficial (Transnet) do {_CL}: {fmt(_ac['kml_ant_oficial'],3)} &rarr; "
                 f"{fmt(_ac['kml_ref_oficial'],3)} — a conta acima roda sobre a telemetria, "
                 f"única fonte com linha, motorista e veículo no mesmo registro.")
    if _ac.get("pior_cluster") and _ac["pior_cluster"] != _CL:
        _rod = f"No mês, quem mais caiu não foi o {_CL} e sim o {_ac['pior_cluster']}. " + _rod

    pages.append(f"""<div class="page-break"></div><div class="page">
  {page_header(f"Diagnóstico do Cluster {_CL} — por que o KM/L variou",
               f"Período: <b>{periodo_label}</b> · {MESANT_NOME} cortado no mesmo dia (01 a {_ac['dia_max']:02d}) para a comparação ser justa",
               "Variação no mês", pct(_ac['var_pct']))}
  <div class="grid-4" style="margin-bottom:7px;">{_kpis}
  </div>{_bloco}
  <div class="cons-box"><div class="cons-title">O que NÃO explica a variação</div>
  <div class="cons-text">{_rod}</div></div>
  {footer(0)}
</div>""")

# ---- Pagina irma do diagnostico: o que aconteceu com a VELOCIDADE do cluster ----
# A velocidade e o que decide a acao: se as mesmas linhas ficaram mais lentas junto com a
# frota, o assunto e transito e tempo de viagem (operacao); se o cluster desacelerou
# sozinho, e escala/itinerario dele. Sem isso o desperdicio da pagina anterior fica sem
# dono - foi o proprio usuario que perguntou "a velocidade caiu, o que aconteceu?".
_v = _ac.get("vel") if _ac else None
if _v and _v["linhas"]:
    _vc = "#c0392b" if (_v["var_pct"] or 0) < 0 else "#1e7a34"
    _fc = "#c0392b" if (_v["frota_var"] or 0) < 0 else "#1e7a34"
    _so_cluster = (_v["frota_var"] is not None and _v["var_pct"] is not None
                   and _v["var_pct"] < _v["frota_var"] - 1.5)
    _junto = (_v["frota_var"] is not None and _v["var_pct"] is not None
              and abs(_v["var_pct"] - _v["frota_var"]) <= 1.5)
    _mix_manda = abs(_v["mix"]) > abs(_v["mesmas"])
    _piores_v = [l for l in _v["linhas"] if (l["var"] or 0) < 0][:3]

    if _junto:
        _tit_v = f"A frota inteira desacelerou junto — é trânsito, não escala do {_CL}"
        _txt_v = (f"O {_CL} saiu de {fmt(_v['vel_ant'],1)} para {fmt(_v['vel_ref'],1)} km/h "
                  f"({pct(_v['var_pct'])}) e a frota toda foi de {fmt(_v['frota_ant'],1)} para "
                  f"{fmt(_v['frota_ref'],1)} km/h ({pct(_v['frota_var'])}) na mesma janela. "
                  f"Como os dois caem quase igual, a desaceleração não é do cluster: é a "
                  f"cidade. O consumo ideal da base não enxerga trânsito, então esse tempo "
                  f"parado aparece como desperdício na página anterior.")
    elif _so_cluster:
        _tit_v = f"O {_CL} desacelerou mais que a frota — o problema é dele"
        _txt_v = (f"O {_CL} caiu {pct(_v['var_pct'])} (de {fmt(_v['vel_ant'],1)} para "
                  f"{fmt(_v['vel_ref'],1)} km/h) enquanto a frota variou {pct(_v['frota_var'])} "
                  f"(de {fmt(_v['frota_ant'],1)} para {fmt(_v['frota_ref'],1)}). A diferença "
                  f"aponta para o que mudou dentro do cluster — itinerário, horário ou escala — "
                  f"e não para trânsito geral.")
    else:
        _tit_v = f"O {_CL} segurou a velocidade melhor que a frota"
        _txt_v = (f"O {_CL} variou {pct(_v['var_pct'])} (de {fmt(_v['vel_ant'],1)} para "
                  f"{fmt(_v['vel_ref'],1)} km/h) contra {pct(_v['frota_var'])} da frota "
                  f"(de {fmt(_v['frota_ant'],1)} para {fmt(_v['frota_ref'],1)}).")
    _txt_v += (f" Dentro do cluster, a mudança de linhas responde por {_sinal(_v['mix'],2)} km/h "
               f"e as mesmas linhas ficando mais lentas por {_sinal(_v['mesmas'],2)} km/h — "
               + ("ou seja, pesou a troca de escala."
                  if _mix_manda else
                  "ou seja, são as mesmas linhas rodando mais devagar."))
    if _piores_v:
        _txt_v += (" Linhas que mais perderam velocidade: "
                   + ", ".join(f"{l['nome']} ({pct(l['var'])})" for l in _piores_v) + ".")
    _n_caiu = sum(1 for l in _v["linhas"] if (l["var"] or 0) < 0)
    _txt_v += (f" De {len(_v['linhas'])} linhas com quilometragem relevante nos dois meses, "
               f"{_n_caiu} perderam velocidade.")

    # Mesmo corte do grafico. O texto avisa quantas ficaram de fora - tabela truncada
    # em silencio faz parecer que o cluster so tem essas linhas.
    _V_MOSTRA = 8
    _v_extra = len(_v["linhas"]) - _V_MOSTRA
    _rows_v = ""
    for l in _v["linhas"][:_V_MOSTRA]:
        cor = "#c0392b" if (l["var"] or 0) < 0 else "#1e7a34"
        _rows_v += (f"<tr><td style='text-align:left;padding-left:7px;font-weight:700;'>{l['nome']}</td>"
                    f"<td>{fmt(l['km_ref']/1000,1)} mil</td>"
                    f"<td>{fmt(l['vel_ant'],1)} &rarr; <b>{fmt(l['vel_ref'],1)}</b></td>"
                    f"<td style='color:{cor};font-weight:800;'>{pct(l['var'])}</td>"
                    f"<td>{fmt(l['share_ant'],1)}% &rarr; {fmt(l['share_ref'],1)}%</td></tr>")

    pages.append(f"""<div class="page-break"></div><div class="page">
  {page_header(f"Cluster {_CL} — o que aconteceu com a velocidade",
               f"Período: <b>{periodo_label}</b> · {MESANT_NOME} cortado no mesmo dia (01 a {_ac['dia_max']:02d}) · velocidade = km rodado ÷ tempo em viagem",
               "Velocidade no mês", f"{fmt(_v['vel_ref'],1)} km/h")}
  <div class="grid-4" style="margin-bottom:7px;">
    <div class="metric"><div class="lbl">Velocidade do {_CL}</div><div class="val" style="color:{_vc};font-size:13px;">{fmt(_v['vel_ant'],1)} &rarr; {fmt(_v['vel_ref'],1)}</div><div class="aux">km/h · {pct(_v['var_pct'])}</div></div>
    <div class="metric"><div class="lbl">Velocidade da frota inteira</div><div class="val" style="color:{_fc};font-size:13px;">{fmt(_v['frota_ant'],1)} &rarr; {fmt(_v['frota_ref'],1)}</div><div class="aux">km/h · {pct(_v['frota_var'])} — mesma janela</div></div>
    <div class="metric"><div class="lbl">Efeito troca de linha</div><div class="val" style="font-size:13px;">{_sinal(_v['mix'],2)}</div><div class="aux">km/h — mudou o que o cluster roda</div></div>
    <div class="metric"><div class="lbl">Efeito mesmas linhas</div><div class="val" style="font-size:13px;">{_sinal(_v['mesmas'],2)}</div><div class="aux">km/h — a linha ficou mais lenta</div></div>
  </div>
  <div class="cons-box" style="margin:0 0 7px 0;border-left:5px solid {_vc};">
    <div class="cons-title">{_tit_v}</div>
    <div class="cons-text" style="font-size:10.2px;line-height:1.4;">{_txt_v}</div></div>
  <div class="card" style="margin-bottom:7px;"><div class="card-title">Velocidade por linha — {MES3ANT} × {MES3REF}</div><div class="card-body" style="padding:4px 8px;">
    <div class="chart-wrap chart-wrap-diag" style="border:none;padding:0;"><img src="v3_cluster_vel.png"/></div>
  </div></div>
  <div class="card"><div class="card-title">Velocidade por linha — detalhamento</div><div class="card-body" style="padding:5px 7px;">
    <table class="tbl-compact"><thead><tr><th style="text-align:left;padding-left:7px;">Linha</th><th>Km rodado</th><th>km/h {MES3ANT}&rarr;{MES3REF}</th><th>Variação</th><th>Participação no km do cluster</th></tr></thead>
    <tbody>{_rows_v}</tbody></table>
    {f'<div style="font-size:7.4px;color:#6B7C79;margin-top:4px;">Mostrando as {_V_MOSTRA} linhas com maior perda de velocidade; outras {_v_extra} ficaram de fora da tabela.</div>' if _v_extra > 0 else ''}
  </div></div>
  {footer(0)}
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
    return de if de == para else f"{de}<span style='color:#9AAEAA;'>→</span>{para}"


def _com_mix(de, para, mix):
    """Predominante do periodo + quanto do mix de km se repetiu entre os dois meses.

    O predominante sozinho dizia pouco: o motorista roda varios carros no mes, e dois
    meses com a mesma frota em ordem trocada pareciam uma troca de veiculo. O percentual
    e a evidencia do veredito da ultima coluna. Sem mix (fallback fixo) nao inventa numero.
    """
    base = _mudou(de, para)
    if mix is None or base == "—":
        return base
    cor = "#16a34a" if mix >= 0.70 else "#e0a800"
    return f"{base} <span style='color:{cor};font-weight:700;'>{round(mix * 100)}%</span>"


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
# Quantos dos que cairam trocaram de linha/carro (causa operacional) e quantos nao trocaram
# nada (ai sim aponta para conducao). E a leitura que a pagina precisa entregar.
_susp_alerta = _suspeitos(gfd.SINAL_ALERTA, -1, com_chapa=False)
# Tabela unica: o KM/L antes/depois era montado (rows_alerta) e nunca exibido, entao a
# pagina mostrava a queda em % sem dizer de quanto para quanto. Agora as duas informacoes
# ficam na mesma linha, junto da causa provavel.
# SINAL_ALERTA: (nome, kml_ant, kml_ref, var_pct) · SINAL_ALERTA_CAUSA: (nome, linha_ant,
# linha_ref, carro_ant, carro_ref, mudou_linha, mudou_carro, mix_linha, mix_carro).
# "Trocou" agora quer dizer que menos de 70% do mix de km se repetiu, nao que o primeiro
# colocado mudou - por isso o texto fala em frota, e nao em "o carro".
_causa_por_nome = {str(c[0]).strip().upper(): c for c in gfd.SINAL_ALERTA_CAUSA}
rows_alerta_full = ""
for a in gfd.SINAL_ALERTA:
    c = _causa_por_nome.get(str(a[0]).strip().upper())
    if c and c[5] is None:
        causa, cor = "Sem dado suficiente", "#6B7C79"
    elif c and c[5] and c[6]:
        causa, cor = "Mudou linha e frota", "#e0a800"
    elif c and c[6]:
        causa, cor = "Mudou de frota (mesma linha)", "#e0a800"
    elif c and c[5]:
        causa, cor = "Mudou de linha (mesma frota)", "#e0a800"
    elif c:
        causa, cor = "Mesma linha e frota — condução", "#dc2626"
    else:
        causa, cor = "—", "#6B7C79"
    _lin = _com_mix(c[1], c[2], c[7]) if c else "—"
    _car = _com_mix(c[3], c[4], c[8]) if c else "—"
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
        f"Dos {len(_ca)} motoristas com maior queda, <b>{len(_ca_troca)}</b> rodaram uma linha "
        f"ou uma frota diferente da do mês anterior — a queda tem explicação operacional e "
        f"cobrar condução deles seria injusto. <b>{len(_ca_comport)}</b> repetiram "
        f"praticamente a mesma linha e os mesmos veículos, e são os casos em que a queda "
        f"aponta de fato para a forma de dirigir"
        + (f"; {len(_ca_semdado)} ficaram sem dado suficiente para classificar." if _ca_semdado
           else ".")
        + " O percentual nas colunas de linha e carro é quanto do mês se repetiu: acima de "
          "70% tratamos como a mesma operação. Priorize os que não mudaram nada.")
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
    <div class="metric" style="{'background:#fef2f2;border-color:#fecaca;' if _ca_comport else ''}"><div class="lbl" style="{'color:#dc2626;' if _ca_comport else ''}">Mesma operação — condução</div><div class="val" style="{'color:#dc2626;' if _ca_comport else ''}">{len(_ca_comport)}</div><div class="aux">repetiram linha e frota do mês</div></div>
  </div>
  <div class="grid-38-62">
    <div class="card"><div class="card-title">Maior queda de KM/L no mês</div><div class="card-body">
      <div class="chart-wrap chart-wrap-tall"><img src="v3_alerta.png"/></div>
    </div></div>
    <div class="card"><div class="card-title">De quanto para quanto — e a queda foi por troca ou por condução?</div><div class="card-body">
      <table class="tbl-alerta"><thead><tr><th style="text-align:left;padding-left:8px;">Motorista</th><th>KM/L {MES3ANT}</th><th>KM/L {MES3REF}</th><th>Var.</th><th>Linha · % igual</th><th>Frota · % igual</th><th style="text-align:left;">Causa provável</th></tr></thead>
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
        causa, cor = "Sem dado suficiente", "#6B7C79"
    elif c and (c[5] or c[6]):
        _q = ("linha e frota" if (c[5] and c[6]) else ("frota" if c[6] else "linha"))
        causa, cor = f"Mudou de {_q}", "#e0a800"
    elif c:
        causa, cor = "Mesma linha e frota — condução", "#16a34a"
    else:
        causa, cor = "—", "#6B7C79"
    _lin = _com_mix(c[1], c[2], c[7]) if c else "—"
    _car = _com_mix(c[3], c[4], c[8]) if c else "—"
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
        f"<b>{len(_dp_conducao)} de {len(_dp)}</b> melhoraram repetindo praticamente a mesma "
        f"linha e os mesmos veículos — nesses a evolução é atribuível à condução, e são os "
        f"casos que servem de referência para quem segue abaixo da meta. Nos demais, a alta "
        f"veio junto de mudança de linha ou de frota, então parte do ganho é operacional.")
else:
    _txt_destaque = (
        f"São os motoristas que mais subiram de {MESANT_NOME} para {MESREF_NOME}. Nenhum "
        f"deles repetiu a mesma linha e a mesma frota no período, então a alta vem "
        f"acompanhada de mudança operacional — use com cautela como referência de condução.")

pages.append(f"""<div class="page-break"></div><div class="page">
  {page_header("Página 10 · Destaque Positivo — Quem Mais Evoluiu", f"Período: <b>{periodo_label}</b>", "Comparação", f"{MESANT_NOME} → {MESREF_NOME}")}
  <div class="grid-4" style="margin-bottom:6px;">
    <div class="metric"><div class="lbl">Motoristas em alta</div><div class="val" style="color:#16a34a;">{len(_dp)}</div><div class="aux">maior evolução no mês</div></div>
    <div class="metric"><div class="lbl">Maior evolução</div><div class="val" style="color:#16a34a;">{pct(_dp[0][3]) if _dp else "—"}</div><div class="aux">{_dp[0][0].title() if _dp else "—"}</div></div>
    <div class="metric"><div class="lbl">Evolução média</div><div class="val" style="color:#16a34a;">{pct(_dp_med)}</div><div class="aux">no recorte dos que subiram</div></div>
    <div class="metric" style="{'background:#f0fdf4;border-color:#bbf7d0;' if _dp_conducao else ''}"><div class="lbl" style="{'color:#15803d;' if _dp_conducao else ''}">Mesma operação — condução</div><div class="val" style="{'color:#16a34a;' if _dp_conducao else ''}">{len(_dp_conducao)}</div><div class="aux">subiram repetindo linha e frota</div></div>
  </div>
  <div class="grid-38-62">
    <div class="card"><div class="card-title">Maior evolução de KM/L no mês</div><div class="card-body">
      <div class="chart-wrap chart-wrap-tall"><img src="v3_destaque.png"/></div>
    </div></div>
    <div class="card"><div class="card-title">De quanto para quanto — e a alta foi por troca ou por condução?</div><div class="card-body">
      <table class="tbl-alerta"><thead><tr><th style="text-align:left;padding-left:8px;">Motorista</th><th>KM/L {MES3ANT}</th><th>KM/L {MES3REF}</th><th>Var.</th><th>Linha · % igual</th><th>Frota · % igual</th><th style="text-align:left;">Causa provável</th></tr></thead>
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
                                   f"<td style='color:#0E7C6E;font-weight:800;'>{t[4]}d</td>"
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
# A pagina respondia "quantos ciclos estao abertos" com dois graficos de duas barras cada.
# As perguntas que ela precisa responder sao outras tres: quantos acompanhamentos cada
# instrutor FEZ, em quantos MOTORISTAS distintos ele encostou (um motorista recebe varias
# sessoes no ciclo, entao os numeros nao se confundem) e quem melhorou e quem piorou depois
# de acompanhado. Os graficos sairam: quatro barras nao justificavam meia pagina cada.
_inst = list(gfd.INSTRUTORES)
_prod = list(gfd.INSTRUTORES_PRODUCAO)
_evo = list(gfd.EVOLUCAO_ACOMP)
# Uniao entre os instrutores; a soma das linhas contaria duas vezes quem foi atendido
# pelos dois. Sem o valor ao vivo, cai na soma e no maximo superestima.
_mot_total = getattr(gfd, "MOTORISTAS_ATENDIDOS", 0) or sum(p.get("motoristas", 0) for p in _prod)

# Melhorou/piorou por instrutor. O empate tecnico (variacao abaixo de 0,01 km/L) fica de
# fora dos dois lados: e ruido de medicao, e contar como melhora inflaria a taxa.
LIMIAR_EVOLUCAO = 0.01
for _e in _evo:
    _e["delta"] = _e["depois"] - _e["antes"]
_melhor = [e for e in _evo if e["delta"] >= LIMIAR_EVOLUCAO]
_pior = [e for e in _evo if e["delta"] <= -LIMIAR_EVOLUCAO]
_estavel = [e for e in _evo if abs(e["delta"]) < LIMIAR_EVOLUCAO]


def _por_instrutor(lista, nome):
    return [e for e in lista if str(e.get("instrutor", "")).strip() == str(nome).strip()]


rows_prod = ""
for p in _prod:
    _m = _por_instrutor(_melhor, p["nome"])
    _p = _por_instrutor(_pior, p["nome"])
    _t = len(_por_instrutor(_evo, p["nome"]))
    _spm = (p["sessoes"] / p["motoristas"]) if p.get("motoristas") else 0
    _taxa = (100 * len(_m) / _t) if _t else None
    rows_prod += (
        f"<tr><td style='text-align:left;padding-left:8px;font-weight:700;'>{p['nome']}</td>"
        f"<td style='font-weight:800;'>{p['sessoes']}</td>"
        f"<td style='font-weight:800;'>{p.get('motoristas', 0)}</td>"
        f"<td>{fmt(_spm,1)}</td><td>{p.get('dias', 0)}</td>"
        f"<td style='color:#16a34a;font-weight:800;'>{len(_m)}</td>"
        f"<td style='color:#dc2626;font-weight:800;'>{len(_p)}</td>"
        f"<td style='font-weight:700;'>{'—' if _taxa is None else fmt(_taxa,0) + '%'}</td></tr>")


def _lista_evolucao(lista, cor, seta, limite=14):
    """Motoristas nomeados, do maior movimento para o menor. Sem truncar em silencio:
    quando sobra gente, a ultima linha diz quantos ficaram de fora."""
    itens = sorted(lista, key=lambda e: -abs(e["delta"]))
    linhas = "".join(
        f"<tr><td style='text-align:left;padding-left:8px;'>{e['nome']}</td>"
        f"<td style='font-size:7.4px;color:#6B7C79;'>{e.get('instrutor', '-').split()[0]}</td>"
        f"<td>{fmt(e['antes'],3)}</td><td style='font-weight:700;'>{fmt(e['depois'],3)}</td>"
        f"<td style='color:{cor};font-weight:800;white-space:nowrap;'>{seta} {fmt(abs(e['delta']),3)}</td></tr>"
        for e in itens[:limite])
    if len(itens) > limite:
        linhas += (f"<tr><td colspan='5' style='text-align:left;padding-left:8px;font-size:7.4px;"
                   f"color:#6B7C79;'>+ {len(itens) - limite} motoristas nesta faixa, "
                   f"não listados por espaço.</td></tr>")
    return linhas


_THEAD_EVO = ('<thead><tr><th style="text-align:left;padding-left:8px;">Motorista</th>'
              '<th>Instrutor</th><th>Antes</th><th>Depois</th><th>Variação</th></tr></thead>')
_taxa_geral = (100 * len(_melhor) / len(_evo)) if _evo else 0
_txt_instrutores = (
    f"Cada instrutor faz várias sessões com o mesmo motorista dentro do ciclo de 30 dias — por "
    f"isso o número de acompanhamentos é maior que o de pessoas atendidas. O que decide se o "
    f"trabalho funcionou é a coluna da direita: dos <b>{len(_evo)}</b> motoristas com KM/L "
    f"medido antes e depois do início do acompanhamento, <b>{len(_melhor)}</b> melhoraram "
    f"({fmt(_taxa_geral,0)}%), <b>{len(_pior)}</b> pioraram e {len(_estavel)} ficaram estáveis "
    f"(variação abaixo de 0,01 km/L, que é ruído de medição). O “antes” são os 30 dias "
    f"anteriores ao início; o “depois”, do início até o fim do período."
    if _evo else
    "Sem motoristas com quilometragem suficiente nas duas janelas para medir evolução — a "
    "produção ao lado é real, mas o resultado do acompanhamento não pôde ser calculado.")

pages.append(f"""<div class="page-break"></div><div class="page">
  {page_header("Página 11 · Instrutores — Produção e Resultado", f"Base: diesel_acompanhamento_sessoes + diesel_acompanhamentos (Supabase INOVE) — {MESREF}", "Instrutores ativos", str(len(_prod) or len(_inst)))}
  <div class="grid-4" style="margin-bottom:6px;">
    <div class="metric"><div class="lbl">Acompanhamentos feitos</div><div class="val">{sum(p['sessoes'] for p in _prod)}</div><div class="aux">sessões em campo no mês</div></div>
    <div class="metric"><div class="lbl">Motoristas atendidos</div><div class="val">{_mot_total}</div><div class="aux">pessoas distintas acompanhadas</div></div>
    <div class="metric"><div class="lbl">Melhoraram o KM/L</div><div class="val" style="color:#16a34a;">{len(_melhor)}</div><div class="aux">de {len(_evo)} com antes e depois medidos</div></div>
    <div class="metric"><div class="lbl">Pioraram o KM/L</div><div class="val" style="color:#dc2626;">{len(_pior)}</div><div class="aux">mesmo estando acompanhados</div></div>
  </div>
  <div class="card" style="margin-bottom:6px;"><div class="card-title">Por instrutor — quanto fez e o que resultou</div><div class="card-body" style="padding:6px 10px;">
    <table class="tbl-big"><thead><tr><th style="text-align:left;padding-left:8px;">Instrutor</th><th>Acomp. feitos</th><th>Motoristas</th><th>Acomp./motorista</th><th>Dias em campo</th><th>Melhoraram</th><th>Pioraram</th><th>% melhora</th></tr></thead>
    <tbody>{rows_prod}</tbody></table>
  </div></div>
  <div class="grid-2" style="align-items:start;">
    <div class="card"><div class="card-title">Melhoraram depois do acompanhamento ({len(_melhor)})</div><div class="card-body" style="padding:6px 10px;">
      <table class="tbl-compact">{_THEAD_EVO}<tbody>{_lista_evolucao(_melhor, "#16a34a", "&#8593;")}</tbody></table>
    </div></div>
    <div class="card"><div class="card-title">Pioraram mesmo acompanhados ({len(_pior)})</div><div class="card-body" style="padding:6px 10px;">
      <table class="tbl-compact">{_THEAD_EVO}<tbody>{_lista_evolucao(_pior, "#dc2626", "&#8595;")}</tbody></table>
    </div></div>
  </div>
  <div class="cons-box" style="margin-top:6px;"><div class="cons-title">Como ler</div>
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
# O detalhamento tem uma linha por (dia, instrutor): num mes fechado passa de 35 linhas e
# nao cabe em meia pagina - transbordava para uma segunda folha, sem cabecalho nem rodape.
# A tabela passa a ocupar a largura toda, quebrada em duas colunas, e o grafico (que tem so
# uma barra por instrutor) divide a faixa de cima com a leitura analitica.
_linhas_diario = [
    (f"<tr><td>{data_}</td><td style='text-align:left;padding-left:6px;'>{inst}</td>"
     f"<td>{n}</td><td>{thoras}</td><td>{tmed} min</td></tr>")
    for data_, inst, n, thoras, tmed in gfd.INSTRUTORES_DIA_A_DIA]
_meio_diario = (len(_linhas_diario) + 1) // 2
_THEAD_DIARIO = ('<thead><tr><th>Data</th><th style="text-align:left;">Instrutor</th>'
                 '<th>Acomp.</th><th>Tempo Total</th><th>Tempo Médio</th></tr></thead>')


def _tabela_diario(linhas):
    return (f'<table class="tbl-compact">{_THEAD_DIARIO}<tbody>{"".join(linhas)}</tbody></table>'
            if linhas else "")


pages.append(f"""<div class="page-break"></div><div class="page">
  {page_header("Página 12 · Instrutores — Aproveitamento do Dia", f"Base: diesel_acompanhamento_sessoes — período de {SEM}", "Instrutores ativos", str(len(gfd.INSTRUTORES)))}
  <div class="grid-2" style="align-items:start;">
    <div class="card"><div class="card-title">Aproveitamento do dia — % da jornada (8h) ocupada</div><div class="card-body">
      <div class="chart-wrap chart-wrap-md"><img src="v3_instrutores_diario.png"/></div>
    </div></div>
    <div class="card"><div class="card-title">Leitura analítica</div><div class="card-body">
      <div class="cons-text">{_txt_p12_jornada}</div>
    </div></div>
  </div>
  <div class="card" style="margin-top:7px;"><div class="card-title">Detalhamento diário — período de {SEM} · {len(_linhas_diario)} registros</div>
    <div class="card-body" style="padding:6px 10px;">
      <div class="grid-2">
        <div>{_tabela_diario(_linhas_diario[:_meio_diario])}</div>
        <div>{_tabela_diario(_linhas_diario[_meio_diario:])}</div>
      </div>
    </div></div>
  {footer(12)}
</div>""")

# ============ PAGINA: COBERTURA DE ACOMPANHAMENTO POR LINHA (3 MESES) ============
# diesel_acompanhamentos so guarda o motorista, entao a linha de cada sessao vem da
# operacao daquele motorista naquele dia. A tabela traz TODAS as linhas que rodaram no
# trimestre, inclusive as zeradas - a lista de quem nao foi acompanhado e o assunto.
_cb = gfd.ACOMP_LINHAS
if _cb and _cb["linhas"]:
    _cb_l = _cb["linhas"]
    _cb_com = [l for l in _cb_l if l["n"] > 0]
    _cb_zero = [l for l in _cb_l if l["n"] == 0]
    _cb_ini = _cb["ini"]
    _cb_ini_lbl = f"{_cb_ini[8:10]}/{_cb_ini[5:7]}/{_cb_ini[:4]}"
    _cb_mot_tot = sum(l["mot_dia"] or 0 for l in _cb_l)
    _cb_med = round(_cb["total"] / _cb_mot_tot, 2) if _cb_mot_tot else 0

    # KM/L do primeiro para o ultimo mes da janela, para colorir a tendencia da linha
    def _cb_tend(l):
        vals = [v for v in l.get("kmls") or [] if v]
        if len(vals) < 2:
            return "", ""
        d = vals[-1] - vals[0]
        return (("#1e7a34" if d > 0 else "#c0392b") if abs(d) >= 0.005 else "#6B7C79",
                ("+" if d > 0 else "−") + fmt(abs(d), 3))

    def _cb_rows(itens):
        out = ""
        for l in itens:
            zero = l["n"] == 0
            cor = "#c0392b" if zero else "#1F2D2B"
            fundo = "background:#fdeeec;" if zero else ""
            cort, tend = _cb_tend(l)
            cels = "".join(f"<td>{fmt(v,3) if v else '&ndash;'}</td>" for v in (l.get("kmls") or []))
            out += (f"<tr style='{fundo}'>"
                    f"<td style='text-align:left;padding-left:7px;font-weight:800;color:{cor};'>{l['linha']}</td>"
                    f"<td style='font-weight:800;color:{cor};font-size:9px;'>{l['n']}</td>"
                    f"<td>{fmt(l['mot_dia'],1) if l.get('mot_dia') else '&ndash;'}</td>"
                    f"<td style='font-weight:700;'>{fmt(l['por_motorista'],2) if l.get('por_motorista') else '&ndash;'}</td>"
                    f"<td>{l['carros_linha']}</td>"
                    + cels
                    + f"<td style='color:{cort};font-weight:800;'>{tend}</td>"
                    f"<td>{fmt(l['km_mil'],1)}</td></tr>")
        return out

    _cb_mm = _cb.get("meses_lbl") or []
    _cb_cab = ("<thead><tr><th style='text-align:left;padding-left:7px;'>Linha</th>"
               "<th>Acomp.</th><th>Motoristas<br/>por dia útil</th>"
               "<th>Acomp. por<br/>motorista</th><th>Carros<br/>da linha</th>"
               + "".join(f"<th>KM/L<br/>{m}</th>" for m in _cb_mm)
               + "<th>Δ KM/L<br/>no trimestre</th><th>Km rodado<br/>(mil)</th></tr></thead>")
    _cb_top = ", ".join(f"{l['linha']} ({l['n']})" for l in _cb_l[:3])
    _cb_cm = [l for l in _cb_l if l.get("por_motorista") is not None]
    _cb_pc = sorted(_cb_cm, key=lambda x: -x["por_motorista"])[:3]
    _cb_pior_pc = [l for l in sorted(_cb_cm, key=lambda x: x["por_motorista"])
                   if (l["mot_dia"] or 0) >= 10][:3]
    _cb_fundo = [l for l in _cb_com][-3:]
    _cb_txt = (f"Nos últimos {_cb['meses']} meses (desde {_cb_ini_lbl}) foram registrados "
               f"<b>{_cb['total']} acompanhamentos</b> distribuídos em "
               f"{len(_cb_com)} das {len(_cb_l)} linhas que rodaram no período. "
               f"A linha de cada acompanhamento vem da operação do motorista naquele dia — "
               f"é onde ele estava rodando, não uma lotação de cadastro. "
               f"Mais acompanhadas em número absoluto: {_cb_top}. "
               f"Proporcionalmente ao efetivo da linha, a melhor cobertura é de "
               + ", ".join(f"{l['linha']} ({fmt(l['por_motorista'],2)} por motorista)" for l in _cb_pc)
               + (("; as mais descobertas entre as linhas de efetivo grande são "
                   + ", ".join(f"{l['linha']} ({fmt(l['por_motorista'],2)})" for l in _cb_pior_pc)
                   + ".") if _cb_pior_pc else ".")
               + " O efetivo é a média de motoristas distintos por dia útil na linha, "
               "descartando os dias em que ela rodou menos da metade do seu km típico "
               "(feriado e dia atípico puxariam o número para baixo).")
    if _cb_zero:
        _cb_txt += (f" <b>{len(_cb_zero)} linha(s) não receberam nenhum acompanhamento</b> "
                    f"no trimestre: " + ", ".join(l["linha"] for l in _cb_zero[:14])
                    + ("..." if len(_cb_zero) > 14 else "") + ".")
    if _cb["sem_operacao"]:
        _cb_txt += (f" {_cb['sem_operacao']} sessão(ões) ficaram de fora por não haver "
                    f"registro de operação do motorista na data.")

    pages.append(f"""<div class="page-break"></div><div class="page">
  {page_header("Cobertura de Acompanhamento por Linha — últimos 3 meses",
               f"Desde <b>{_cb_ini_lbl}</b> · linha do acompanhamento = onde o motorista rodou no dia · ordenado pelo total de acompanhamentos · efetivo = média de motoristas por dia útil",
               "Acompanhamentos", str(_cb["total"]))}
  <div class="grid-4" style="margin-bottom:7px;">
    <div class="metric"><div class="lbl">Acompanhamentos no trimestre</div><div class="val">{_cb['total']}</div><div class="aux">desde {_cb_ini_lbl}</div></div>
    <div class="metric"><div class="lbl">Linhas atendidas</div><div class="val">{len(_cb_com)} de {len(_cb_l)}</div><div class="aux">linhas que rodaram no período</div></div>
    <div class="metric"><div class="lbl">Linhas sem nenhum</div><div class="val" style="color:{'#c0392b' if _cb_zero else '#1e7a34'};">{len(_cb_zero)}</div><div class="aux">nenhum acompanhamento no trimestre</div></div>
    <div class="metric"><div class="lbl">Média por motorista</div><div class="val">{fmt(_cb_med,2)}</div><div class="aux">acomp. por motorista programado no trimestre</div></div>
  </div>
  <div class="card" style="margin-bottom:7px;"><div class="card-body" style="padding:5px 7px;">
    <table class="tbl-compact">{_cb_cab}<tbody>{_cb_rows(_cb_l)}</tbody></table>
  </div></div>
  <div class="cons-box" style="margin-top:0;"><div class="cons-title">Leitura da cobertura</div>
  <div class="cons-text">{_cb_txt}</div></div>
  {footer(0)}
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
        cor, seta = "#9AAEAA", "="
    elif delta > 0:
        cor, seta = "#16a34a", "&#8593;"
    else:
        cor, seta = "#dc2626", "&#8595;"
    _kma = f"{a['km_antes']:,}".replace(",", ".") if a.get("km_antes") else "—"
    _kmd = f"{a['km_depois']:,}".replace(",", ".") if a.get("km_depois") else "—"
    rows_acomp += (f"<tr><td style='text-align:left;padding-left:6px;'>{a['nome']}</td>"
                   f"<td>{a['instrutor']}</td><td>{a['status']}</td>"
                   f"<td style='color:#6B7C79;'>{_kma}</td><td>{fmt(a['antes'],3)}</td>"
                   f"<td style='color:#6B7C79;'>{_kmd}</td><td style='font-weight:700;'>{fmt(a['depois'],3)}</td>"
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
                     f"<td style='font-weight:700;color:#0E7C6E;'>R$ {m[2]}</td><td>{fmt(m[3],2)}</td></tr>")

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
def _janela_carro(d):
    """Dias usados + de quando sao. A janela nao e igual para todo carro: leitura absurda
    nos dias recentes e descartada, e a busca recua - sem mostrar as datas, o leitor
    tomaria um numero de duas semanas atras como sendo de ontem."""
    if len(d) < 8 or not d[5]:
        return "—"
    if not (d[6] and d[7]):
        return str(d[5])
    _f = lambda iso: f"{iso[8:10]}/{iso[5:7]}"
    return (f"{d[5]}<div style='font-size:6.6px;color:#6B7C79;font-weight:600;'>"
            f"{_f(d[6])}–{_f(d[7])}</div>")


# DIVERGENCIA_CARROS: (carro, kml_transnet, kml_sst, divergencia_pct, km, dias, 1o, ultimo).
# A pagina mostra os maiores, mas quem conta e a lista INTEIRA: o KPI do topo vinha do
# recorte ja cortado e anunciava 8 quando existiam 9 acima do corte.
_dv_todos = sorted(gfd.DIVERGENCIA_CARROS, key=lambda x: -abs(x[3]))
_DV_MAX = getattr(gfd, "DIVERGENCIA_MOSTRA", 8)
_dv = _dv_todos[:_DV_MAX]
_dv_total = len(_dv_todos)
_dv_extra = max(0, _dv_total - len(_dv))
_p16_n = len(_dv)
_p16_plural = "carro" if _p16_n == 1 else "carros"
_p16_plural_total = "carro" if _dv_total == 1 else "carros"
_p16_essas = "esse caso não é apenas estilo de condução" if _p16_n == 1 else \
             f"os {_p16_n} casos acima não são apenas estilo de condução"
# Sobre TODOS, nao sobre os exibidos: a frase conta os N do total, entao o piso tem de
# ser o do total. Com o menor dos 8 exibidos, ela afirmava "12 carros acima de 22%"
# quando os 4 nao exibidos estavam entre 10% e 22%.
_p16_min = fmt(min(abs(d[3]) for d in _dv_todos), 0) if _dv_todos else "10"
rows_diverg = ""
for d in _dv:
    rows_diverg += (f"<tr><td style='font-weight:bold;text-align:left;padding-left:6px;'>{d[0]}</td>"
                     f"<td>{fmt(d[1],3)}</td><td>{fmt(d[2],3)}</td>"
                     f"<td style='font-weight:800;color:{'#dc2626' if d[3]<0 else '#e0a800'};'>{pct(d[3])}</td>"
                     f"<td>{d[4]} km</td>"
                     f"<td>{_janela_carro(d)}</td></tr>")

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
  {page_header("Página 16 · Divergência Telemetria x Transnet por Carro (≥10%)", f"Fonte: indicadores_diesel — por carro, os últimos {gfd.DIAS_DIVERGENCIA} dias com leitura nas DUAS fontes (mín. {gfd.KM_MIN_DIVERGENCIA} km acumulados)", "Carros com divergência ≥10%", str(_dv_total))}
  <div class="grid-2">
    <div class="card"><div class="card-title">Divergências ≥10% (mín. {gfd.KM_MIN_DIVERGENCIA} km na janela){f" — os {len(_dv)} maiores de {_dv_total}" if _dv_extra else ""}</div><div class="card-body">
      <div class="chart-wrap chart-wrap-tall"><img src="v3_divergencia.png"/></div>
    </div></div>
    <div class="card"><div class="card-title">Detalhamento</div><div class="card-body">
      <table class="tbl-big"><thead><tr><th style="text-align:left;padding-left:10px;">Carro</th><th>KM/L Transnet</th><th>KM/L SST</th><th>Diferença</th><th>Km na janela</th><th>Dias</th></tr></thead>
      <tbody>{rows_diverg.replace("padding-left:6px", "padding-left:10px")}</tbody></table>
      <div class="cons-box" style="margin-top:8px;"><div class="cons-title">Considerações</div>
      <div class="cons-text">Ao abrir o corte para ≥10%, nenhum carro novo aparece — a base é bimodal: ou a divergência é enorme (≥{_p16_min}%, {_dv_total} {_p16_plural_total} no total) ou é pequena (abaixo de 10%). Isso reforça que {_p16_essas}, e sim fortes candidatos a problema de calibração de sensor ou telemetria com falha de leitura. Recomenda-se checagem física nesses veículos antes de usar o dado de Telemetria para decisões individuais sobre eles.</div></div>
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
# Lista vazia = visita sem registro fotografico (o bloco de imagens some da pagina).
# Cada item e (arquivo, foco vertical). As fotos chegam do WhatsApp com orientacao mista
# (as de agosto sao 2 paisagem + 1 retrato) e larguras livres deixavam o retrato com 40px:
# ao lado de uma paisagem 2,2:1, um retrato 0,45:1 na mesma altura vira uma tira. Entao as
# celulas sao iguais e a foto preenche com object-fit:cover - o que muda por foto e ONDE o
# recorte se apoia. Paisagem de grupo pede ~40%; retrato de corpo inteiro pede ~24%, senao
# o corte pega a cintura em vez do rosto. So um numero para acertar no mes que vem.
FOTOS_NOTURNO_ARQUIVOS = [
    ("noturno_ago_1.jpg", "40%"),
    ("noturno_ago_2.jpg", "40%"),
    ("noturno_ago_3.jpg", "24%"),
]
# inline-block em vez de flex de proposito: o flex-wrap do WeasyPrint nao e confiavel e as
# fotos empilhavam uma por linha. font-size:0 no pai mata o espaco entre os inline-blocks.
# As fotos ficavam num card de meia folha, com ~155px de largura cada - o registro da
# visita saia espremido. Agora a faixa e um card de largura cheia embaixo dos dois cards
# de texto, entao cada foto ganha ~1/3 da folha (o dobro de area). A altura acompanha.
# A largura se divide pelo numero de fotos, com folga para o arredondamento nao quebrar
# a linha: com 4 fotos elas ficam menores em vez de a quarta cair sozinha embaixo.
_N_FOTOS = max(len(FOTOS_NOTURNO_ARQUIVOS), 1)
_LARG_FOTO = 99.0 / _N_FOTOS - 0.8
FOTOS_NOTURNO = "".join(
    f'<div style="display:inline-block;width:{_LARG_FOTO:.2f}%;height:150px;margin:0 .4%;'
    f'border-radius:10px;overflow:hidden;border:1px solid #CFE4DF;vertical-align:top;">'
    f'<img src="{_f}" style="width:100%;height:100%;object-fit:cover;'
    f'object-position:center {_foco};display:block;"/></div>'
    for _f, _foco in FOTOS_NOTURNO_ARQUIVOS)
FOTOS_NOTURNO_BLOCO = (
    f'<div class="card" style="margin-top:7px;"><div class="card-title">Registro fotográfico da visita</div>'
    f'<div class="card-body" style="padding:7px 8px;text-align:center;font-size:0;line-height:0;">'
    f'{FOTOS_NOTURNO}</div></div>'
    if FOTOS_NOTURNO_ARQUIVOS else "")
# ================= PAGINA 17: ACOMPANHAMENTO NOTURNO =================
# Esta pagina tem so dois cards curtos e sobrava quase metade da folha em branco (a visita
# de julho nem teve fotos). A pagina vira uma coluna flex e o grid ocupa a altura restante,
# entao os dois cards esticam ate o rodape e o calendario cresce junto (linhas 1fr) em vez
# de ficar espremido no topo. margin-bottom deixa a faixa do rodape livre - ele e absoluto.
pages.append(f"""<div class="page-break"></div><div class="page" style="display:flex;flex-direction:column;">
  {page_header("Página 17 · Acompanhamento Noturno", "Visitas de acompanhamento presencial no período noturno — garagem", "Próxima visita", "28/08")}
  <div class="grid-2" style="flex:1;min-height:0;margin-bottom:0;">
    <div class="card" style="display:flex;flex-direction:column;"><div class="card-title">Calendário de visitas — {MESREF}</div><div class="card-body" style="flex:1;display:flex;flex-direction:column;">
      <div style="display:grid;grid-template-columns:repeat(7,1fr);gap:4px;margin-bottom:2px;">{CAL_JULHO_HEADER}</div>
      <div style="display:grid;grid-template-columns:repeat(7,1fr);grid-auto-rows:1fr;gap:4px;flex:1;">{CAL_JULHO_CELLS}</div>
      <div class="cons-box" style="margin-top:8px;"><div class="cons-title">Programação</div>
      <div class="cons-text">{len(_visita_label)} visitas noturnas programadas para {MESREF_NOME.lower()} — {_visitas_datas} — mantendo a cadência mensal de visitas noturnas. Cada visita inclui verificação de manobras no pátio, orientação aos motoristas em campo e reforço das boas práticas de condução econômica.</div></div>
    </div></div>
    <div class="card" style="display:flex;flex-direction:column;"><div class="card-title">Última visita realizada — 14/08/2026</div><div class="card-body" style="flex:1;display:flex;flex-direction:column;">
      <div style="font-weight:800;font-size:10.5px;color:#1F2D2B;margin-bottom:2px;">Treinamento Prático de Manobristas em Campo — Acompanhamento do Instrutor</div>
      <div style="font-size:7.8px;color:#0E7C6E;font-weight:700;margin-bottom:4px;">Acompanhamento: instrutor Hélio</div>
      <div class="cons-text" style="text-align:justify;">Foi realizado treinamento prático com os manobristas em campo, com acompanhamento do instrutor, trabalhando a dinâmica “o instrutor leva e o manobrista traz”, proporcionando mais segurança e confiança durante as manobras.</div>
      <div class="cons-text" style="text-align:justify;margin-top:5px;">Também foi realizado teste prático de manobrista para motorista, sendo o colaborador Maurício <b>APROVADO</b> na avaliação e apto a exercer a função de motorista.</div>
      <div class="cons-text" style="text-align:justify;margin-top:5px;">Treinamento, avaliação e desenvolvimento profissional em busca de mais segurança e qualidade na operação.</div>
      <div class="metric" style="margin-top:auto;"><div class="lbl">Próxima visita programada</div><div class="val" style="font-size:13px;">28/08/2026</div>
        <div style="font-size:7.6px;color:#48605C;margin-top:2px;">2ª e última visita noturna de agosto</div></div>
    </div></div>
  </div>
  {FOTOS_NOTURNO_BLOCO}
  {footer(17)}
</div>""")

# [COWORK] CRONOGRAMA (18) — dado MANUAL: regenere este HTML com as semanas/itens do mes que o
# usuario informar (mesmo estilo de cards). Ver COWORK_FLASH.md.
# ================= PAGINA 18: PROGRAMACAO DA SEMANA =================
# Estrutura: (titulo_semana, intervalo, [(tipo, tema, data, executado), ...])
# executado=False -> item nao executado (bolinha vazia), igual ao board. A data so fica
# vermelha se ja venceu; o que ainda vai acontecer no mes e programacao, nao atraso.
CRONOGRAMA = [
    ("1ª Semana", "03 a 07/08", [
        ("Imagem Motivacional", "", "03/08", True),
        ("Vídeo - Min. do Conhecimento", "Parado Ligado: Consumo ou Desperdício?", "04/08", True),
        ("Imagem Informativa", "Parado Ligado: Consumo ou Desperdício?", "05/08", True),
        ("Podcast - Fala, Motô!", "Benefícios sem Mistério: Entenda Como Tudo Funciona", "06/08", True),
        ("Enquete de Fixação", "Parado Ligado: Consumo ou Desperdício?", "07/08", True),
    ]),
    ("2ª Semana", "10 a 14/08", [
        ("Imagem Motivacional", "", "10/08", True),
        ("Vídeo - Min. do Conhecimento", "i9mtra", "11/08", True),
        ("Imagem Informativa", "Carros com Vazamento de Ar", "12/08", True),
        ("Podcast - Fala, Motô!", "", "13/08", True),
        ("Enquete de Fixação", "Carros com Vazamento de Ar", "14/08", True),
    ]),
    ("3ª Semana", "17 a 21/08", [
        ("Imagem Motivacional", "", "17/08", True),
        ("Vídeo - Min. do Conhecimento", "Extra Econômica", "18/08", True),
        ("Imagem Informativa", "Extra Econômica", "19/08", True),
        ("Podcast - Fala, Motô!", "Segredos de um Bom KM/L: Hábitos que fazem a diferença", "20/08", True),
        ("Enquete de Fixação", "Extra Econômica", "21/08", True),
    ]),
    ("4ª Semana", "24 a 28/08", [
        ("Imagem Motivacional", "", "24/08", False),
        ("Vídeo - Min. do Conhecimento", "", "25/08", False),
        ("Imagem Informativa", "", "26/08", False),
        ("Podcast - Fala, Motô!", "", "27/08", False),
        ("Enquete de Fixação", "", "28/08", False),
    ]),
    ("5ª Semana", "31/08", [
        ("Imagem Motivacional", "", "31/08", False),
    ]),
]

_ROW = ('<div style="display:flex;justify-content:space-between;align-items:flex-start;'
        'padding:4px 0;border-bottom:1px solid #EAF4F2;"><div style="flex:1;">'
        '<span style="color:{cor};font-weight:800;margin-right:4px;">{marca}</span>'
        '<span style="font-size:8.6px;font-weight:700;color:#1F2D2B;">{tipo}</span>{sub}</div>'
        '<div style="font-size:8px;color:{cor_data};font-weight:700;white-space:nowrap;'
        'margin-left:6px;">{data}</div></div>')


# MES_FIM e exclusivo (= dia da geracao), entao "venceu" e data anterior a ele: o item
# caiu dentro do periodo analisado e nao foi executado. Data futura fica cinza.
def _crono_venceu(data):
    _d, _m = (int(x) for x in data.split("/"))
    return _dt6.date(gfd.MES_REF_ANO, _m, _d) < gfd.MES_FIM


def _crono_card(titulo, intervalo, itens):
    linhas = ""
    for tipo, tema, data, feito in itens:
        sub = (f'<div style="font-size:7.6px;color:#48605C;margin-top:1px;">{tema}</div>'
               if tema else "")
        atrasado = not feito and _crono_venceu(data)
        linhas += _ROW.format(cor="#16a34a" if feito else "#cbd5e1",
                              marca="&#10003;" if feito else "&#9675;",
                              tipo=tipo, sub=sub, data=data,
                              cor_data="#dc2626" if atrasado else "#6B7C79" if feito else "#9AAEAA")
    return (f'<div class="card" style="margin-bottom:7px;"><div class="card-title">{titulo} — {MESREF} '
            f'<span style="font-weight:400;opacity:.85;">({intervalo})</span></div>'
            f'<div class="card-body" style="padding:6px 10px;">{linhas}</div></div>')


_crono_cards = [_crono_card(t, i, its) for t, i, its in CRONOGRAMA]
_n_itens = sum(len(its) for _, _, its in CRONOGRAMA)
_n_feitos = sum(1 for _, _, its in CRONOGRAMA for it in its if it[3])
# lista de pendentes derivada do proprio CRONOGRAMA, para nao contradizer os checks.
# So entra quem ja venceu; o resto do mes conta como programado, nao como atraso.
_pend = [(t, d) for _, _, its in CRONOGRAMA for t, _tema, d, feito in its
         if not feito and _crono_venceu(d)]
_n_prog = sum(1 for _, _, its in CRONOGRAMA for it in its
              if not it[3] and not _crono_venceu(it[2]))
_crono_pend = ("Consta pendente: " + "; ".join(f"{t} de {d}" for t, d in _pend) + "."
               if _pend else "Nenhum conteúdo vencido em aberto.")
if _n_prog:
    _crono_pend += f" Os outros {_n_prog} conteúdos seguem programados para as semanas seguintes."
_metade = (len(_crono_cards) + 1) // 2
_crono_left = "".join(_crono_cards[:_metade])
_crono_right = "".join(_crono_cards[_metade:])
pages.append(f"""<div class="page-break"></div><div class="page">
  {page_header("Página 18 · Programação Educativa — Conteúdo Motorista/Motô", f"Cronograma de comunicação e engajamento, semana a semana — {MESREF}", "Conteúdos executados", f"{_n_feitos}/{_n_itens}")}
  <div class="grid-2" style="align-items:start;">
    <div>{_crono_left}</div>
    <div>{_crono_right}
      <div class="cons-box"><div class="cons-title">Sobre o cronograma</div>
      <div class="cons-text">Programação semanal de comunicação e engajamento com os motoristas, combinando imagem motivacional, vídeo de conhecimento, imagem informativa, podcast e enquete de fixação. Das {len(CRONOGRAMA)} semanas de {MESREF_NOME.lower()}, {_n_feitos} dos {_n_itens} conteúdos já foram executados. A série da 1ª semana foi "Parado Ligado: Consumo ou Desperdício?", trabalhada em vídeo, imagem informativa e enquete de fixação para reforçar o custo do motor em marcha lenta, somada ao podcast "Benefícios sem Mistério: Entenda Como Tudo Funciona". A 2ª semana tratou de "Carros com Vazamento de Ar" em imagem informativa e enquete de fixação, tema de manutenção que impacta diretamente o consumo. Na 3ª semana a série foi "Extra Econômica", fechando com o podcast "Segredos de um Bom KM/L: Hábitos que fazem a diferença" — o tema mais direto ao indicador que este relatório acompanha. {_crono_pend}</div></div>
    </div>
  </div>
  {footer(18)}
</div>""")

# ================= PAGINA 14: MELHORIA CONTINUA =================
sug_acomp_rows = "".join(
    f"""<div class="card" style="margin-bottom:6px;"><div class="card-body" style="padding:7px 10px;">
    <div style="font-weight:800;font-size:9.5px;color:#1F2D2B;">{s[0]}</div>
    <div style="font-size:8.6px;color:#48605C;margin-top:2px;">{s[1]}</div>
    <div style="font-size:8.8px;color:#0E7C6E;font-weight:700;margin-top:3px;">→ {s[2]}</div>
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
                         f"<td style='text-align:left;font-size:8px;color:#0E7C6E;font-weight:700;'>{s[2]}</td></tr>")

pages.append(f"""<div class="page-break"></div><div class="page">
  {page_header("Página 19 · Melhoria Contínua — Plano de Ação da Semana", "Síntese analítica sobre tratativas, acompanhamentos, linhas, carros e instrutores", "Foco #1 da semana", _p19_foco)}
  <div class="grid-3" style="margin-bottom:6px;">
    <div class="metric" style="background:#fef2f2;border-color:#fecaca;"><div class="lbl" style="color:#dc2626;">Ação imediata</div><div class="val" style="font-size:11px;color:#1F2D2B;">{_p19_acao}</div><div class="aux">{_p19_acao_aux}</div></div>
    <div class="metric" style="background:#fffbeb;border-color:#fde68a;"><div class="lbl" style="color:#b45309;">Investigar</div><div class="val" style="font-size:11px;color:#1F2D2B;">{_p19_inv}</div><div class="aux">{_p19_inv_aux}</div></div>
    <div class="metric" style="background:#f0fdf4;border-color:#bbf7d0;"><div class="lbl" style="color:#15803d;">Replicar</div><div class="val" style="font-size:11px;color:#1F2D2B;">{_p19_rep}</div><div class="aux">Vale testar em outros motoristas da mesma linha</div></div>
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

# Grupos por PALAVRA-CHAVE do titulo, nao por faixa de pagina. As faixas eram fixas
# ((2,6), (7,9)...) e, quando paginas foram divididas e uma removida, 13 das 20 sumiram do
# indice sem aviso - o mesmo tipo de lista paralela que envelhece que este relatorio ja
# tinha em varios lugares. Assim as faixas se recalculam sozinhas.
# Indice no formato do Flash de Manutencao: card unico "CONTEUDO", lista corrida com o
# numero em teal e listra alternada. Sem grupos tematicos - a numeracao sequencial ja
# organiza, e o agrupamento por faixa de pagina foi o que quebrou quando as paginas
# mudaram de lugar.
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


# O indice era uma coluna so. Com as paginas novas passou de 20 entradas, estourou a
# altura fixa da folha e o PDF ganhou uma pagina extra sem rodape (a verificacao de
# layout pegou). Em duas colunas cabe ate ~30 sem apertar a linha.
def _idx_coluna(itens):
    return "".join(
        f'<tr style="background:{"#ffffff" if i % 2 else "#EAF4F2"};">'
        f'<td style="width:44px;text-align:center;font-size:10.5px;font-weight:800;'
        f'color:#0E7C6E;padding:5px 4px;">{n:02d}</td>'
        f'<td style="text-align:left;padding:5px 10px;font-size:9.6px;color:#1F2D2B;">'
        f'{_cap_titulo(t)}</td></tr>'
        for i, (n, t) in enumerate(itens))


_idx_meio = (len(_idx) + 1) // 2
_idx_esq = _idx_coluna(_idx[:_idx_meio])
_idx_dir = _idx_coluna(_idx[_idx_meio:])

pages.insert(1, f"""<div class="page-break"></div><div class="page">
  {page_header("Índice do relatório", f"Condução Econômica · Flash Report Diesel", "Mês", MESREF, numerar=False)}
  <div class="card"><div class="card-title">Conteúdo</div><div class="card-body" style="padding:6px 10px;">
    <div class="grid-2" style="gap:14px;margin-bottom:0;">
      <table style="border-collapse:separate;border-spacing:0;"><tbody>{_idx_esq}</tbody></table>
      <table style="border-collapse:separate;border-spacing:0;"><tbody>{_idx_dir}</tbody></table>
    </div>
  </div></div>
  <div class="cons-box"><div class="cons-title">Como ler este relatório</div>
  <div class="cons-text">{_COMO_LER_JANELA} O KM/L oficial vem do Transnet; a Telemetria entra como fonte de comparação, e divergências entre as duas são tratadas na página 17. Uma faixa vermelha na capa indica que alguma página não conseguiu carregar dado atualizado.</div></div>
</div>""")

html = f"""<!DOCTYPE html><html lang="pt-BR"><head><meta charset="UTF-8"/><title>Flash Report Diesel v3</title>
<style>{CSS}</style></head><body>
{''.join(pages)}
</body></html>"""

# Aviso de transbordo: cada .page tem altura fixa e o weasyprint quebra em duas quando o
# conteudo passa. Com dado ao vivo as tabelas crescem e isso aconteceu sem ninguem notar -
# o PDF saiu com 23 paginas em vez de 21. Compara o previsto com o gerado no fim.
print(f"[layout] {_NUM[0]} paginas numeradas + capa + indice = {_NUM[0] + 1} esperadas no PDF.")
# O numero fica em disco para o verifica_layout.py conferir contra o PDF ja renderizado:
# so imprimir o esperado nao adiantou nada, o PDF quebrado passou assim mesmo.
(OUT / "paginas_esperadas.txt").write_text(str(_NUM[0] + 1), encoding="utf-8")
html = html.replace("@@TOTAL@@", str(_NUM[0]))
(OUT / "flash_report_diesel_v3.html").write_text(html, encoding="utf-8")
print("HTML v3 gerado.")
