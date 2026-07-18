# -*- coding: utf-8 -*-
# ==============================================================================
# FLASH DIÁRIO DE MANUTENÇÃO — 2 páginas (teal) + envio no Telegram
# ------------------------------------------------------------------------------
# Página 1: "O DIA" — ancorada em DIA_REF (último dia com KM consolidado).
# Página 2: "A MANHÃ DE HOJE" — foto operacional da manhã (GNS, filas, alertas).
# Reusa as funções de dados do gen_flash_manutencao.py (mesma pasta).
# Env: mesmos nomes de Supabase do semanal + TELEGRAM_BOT_TOKEN/TELEGRAM_CHAT_ID.
# TELEGRAM_DRY_RUN=1 → não envia; só imprime o caption e salva os PNGs.
# ==============================================================================

import os
import sys
import json
from datetime import datetime, date, timedelta, timezone
from pathlib import Path

import pandas as pd

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import gen_flash_manutencao as flr  # noqa: E402  (reuso das funções de dados)

from playwright.sync_api import sync_playwright  # noqa: E402

TZ_BRT = timezone(timedelta(hours=-3))
MKBF_META = flr.MKBF_META

PASTA_SAIDA = Path(os.getenv("REPORT_OUTPUT_DIR", "Relatorios_Manutencao"))

DIAS_SEMANA = ["SEGUNDA", "TERÇA", "QUARTA", "QUINTA", "SEXTA", "SÁBADO", "DOMINGO"]
DIAS_ABREV = ["SEG", "TER", "QUA", "QUI", "SEX", "SÁB", "DOM"]


def _ddmm(d: date) -> str:
    return d.strftime("%d/%m")


def _dia_semana(d: date) -> str:
    return DIAS_SEMANA[d.weekday()]


def _dia_abrev(d: date) -> str:
    return DIAS_ABREV[d.weekday()]


def _hhmm(v) -> str:
    s = str(v or "").strip()
    return s[:5] if s else "—"


def _ddmm_str(s) -> str:
    """Converte 'YYYY-MM-DD' (string do banco) em 'DD/MM'."""
    try:
        return date.fromisoformat(str(s)[:10]).strftime("%d/%m")
    except Exception:
        return str(s or "—")


def _trunc(s, n=40):
    s = str(s or "").strip()
    if not s or s.lower() in ("none", "nan"):
        return "—"
    return (s[: n - 1] + "…") if len(s) > n else s


def _pill_tipo(tipo: str) -> str:
    t = str(tipo or "").upper()
    cls = {"TROCA": "troca", "RECOLHEU": "recolheu", "SOS": "sos", "AVARIA": "avaria"}.get(t, "avaria")
    label = t.capitalize() if t != "SOS" else "SOS"
    return f'<span class="pill {cls}">{label}</span>'


def _pill_categoria(cat: str) -> str:
    c = str(cat or "").upper()
    if "GNS" in c:
        return '<span class="pill gns">GNS</span>'
    if "GARANT" in c:
        return '<span class="pill gar">Garantia</span>'
    return '<span class="pill pend">Pend.</span>'


def _setor_abrev(s: str) -> str:
    u = str(s or "").strip().upper()
    if u.startswith("SUPRIM"):
        return "Suprim."
    if u.startswith("MANUT"):
        return "Manut."
    if u.startswith("GARANT"):
        return "Garantia"
    return _trunc(s, 10)


# ==============================================================================
# COLETA DE DADOS
# ==============================================================================
def coletar_dados() -> dict:
    hoje = datetime.now(TZ_BRT).date()
    ontem = hoje - timedelta(days=1)
    ini_mes = flr.month_start(hoje)

    # ---- DIA_REF: último dia com KM consolidado (janela de ~8 dias) ----
    km_janela = flr.processar_km_df(flr.carregar_km_rodado(hoje - timedelta(days=8), hoje))
    if km_janela.empty:
        dia_ref = ontem
        km_dia = 0.0
    else:
        dia_ref = km_janela["data"].max()
        km_dia = float(km_janela[km_janela["data"] == dia_ref]["km_total"].sum())
    print(f"📅 HOJE={hoje} | DIA_REF={dia_ref} | KM do dia={km_dia:.0f}")

    # ---- SOS do DIA_REF ----
    so = pd.DataFrame(flr.fetch_all_table_period(
        table_name="sos_acionamentos",
        select_fields="numero_sos, data_sos, hora_sos, veiculo, linha, ocorrencia, status, problema_encontrado, setor_manutencao",
        date_field="data_sos", start_date=dia_ref, end_date=dia_ref))
    if not so.empty:
        so["tipo"] = so["ocorrencia"].apply(flr.normalize_tipo)
        so["valida"] = so["ocorrencia"].apply(flr.is_ocorrencia_valida_para_mkbf)
    validas_dia = int(so["valida"].sum()) if not so.empty else 0
    registros_dia = int(len(so)) if not so.empty else 0
    seguiu_dia = int((so["tipo"] == "SEGUIU VIAGEM").sum()) if not so.empty else 0
    mkbf_dia = (km_dia / validas_dia) if validas_dia else 0.0

    # ---- MKBF do mês (01..DIA_REF, só dias com KM p/ km; válidas até DIA_REF) ----
    km_mes_proc = flr.processar_km_df(flr.carregar_km_rodado(ini_mes, dia_ref))
    km_mes = float(km_mes_proc["km_total"].sum()) if not km_mes_proc.empty else 0.0
    dias_com_km = int(len(km_mes_proc))
    sos_mes = pd.DataFrame(flr.fetch_all_table_period(
        table_name="sos_acionamentos", select_fields="data_sos, ocorrencia",
        date_field="data_sos", start_date=ini_mes, end_date=dia_ref))
    validas_mes = int(sos_mes["ocorrencia"].apply(flr.is_ocorrencia_valida_para_mkbf).sum()) if not sos_mes.empty else 0
    mkbf_mes = (km_mes / validas_mes) if validas_mes else 0.0
    media_validas_dia = (validas_mes / dias_com_km) if dias_com_km else 0.0

    # ---- Válidas nos dias APÓS o DIA_REF (aguardando KM consolidar) ----
    pos = pd.DataFrame()
    validas_pos = 0
    if dia_ref < hoje:
        pos = pd.DataFrame(flr.fetch_all_table_period(
            table_name="sos_acionamentos",
            select_fields="data_sos, veiculo, ocorrencia, problema_encontrado, setor_manutencao",
            date_field="data_sos", start_date=dia_ref + timedelta(days=1), end_date=hoje))
        if not pos.empty:
            pos["valida"] = pos["ocorrencia"].apply(flr.is_ocorrencia_valida_para_mkbf)
            validas_pos = int(pos["valida"].sum())

    # ---- Regenerações do DIA_REF ----
    regen = pd.DataFrame(flr.fetch_all_table_period(
        table_name="eventos_regeneracao", select_fields="prefixo, dt_inicio, custo_reais",
        date_field="dt_inicio", start_date=dia_ref, end_date=dia_ref, sb_client=flr._sb_a()))
    regen_eventos = int(len(regen))
    regen_custo = float(flr._to_num(regen["custo_reais"]).sum()) if not regen.empty else 0.0
    regen_veiculos = int(regen["prefixo"].nunique()) if not regen.empty else 0

    # ---- Preventivas realizadas no DIA_REF (e ontem, p/ nota) ----
    prev = flr._fetch_all_rows(flr._sb_b(), "preventivas", "prefixo, data_realizacao, tipo")
    if not prev.empty:
        prev["d"] = prev["data_realizacao"].astype(str).str[:10]
    pv_dia = prev[prev["d"] == str(dia_ref)] if not prev.empty else pd.DataFrame()
    pv_ontem = prev[prev["d"] == str(ontem)] if not prev.empty else pd.DataFrame()
    prev_10k = int(pv_dia["tipo"].astype(str).str.contains("10.000", regex=False).sum()) if not pv_dia.empty else 0
    insp_5k = int(pv_dia["tipo"].astype(str).str.contains("5.000", regex=False).sum()) if not pv_dia.empty else 0

    # A tabela `preventivas` tem lag de lançamento (as do dia 15 só entraram no dia 17).
    # Se o DIA_REF é posterior ao último dia já lançado, "0" NÃO significa "não fez" —
    # significa "ainda não lançado". Distinguir os dois casos é essencial: um acusa a
    # oficina de não trabalhar, o outro explica que o dado não chegou.
    prev_ultimo_lancado = max(prev["d"].dropna()) if not prev.empty else None
    prev_aguardando = bool(prev_ultimo_lancado and str(dia_ref) > prev_ultimo_lancado)
    prev_ontem_aguardando = bool(prev_ultimo_lancado and str(ontem) > prev_ultimo_lancado)

    # ---- Etiquetas em aberto (status Aberto, mês corrente) ----
    mesdf = pd.DataFrame(flr.fetch_all_table_period(
        table_name="sos_acionamentos",
        select_fields="numero_sos, data_sos, hora_sos, veiculo, linha, ocorrencia, status",
        date_field="data_sos", start_date=ini_mes, end_date=hoje))
    etiquetas = pd.DataFrame()
    if not mesdf.empty:
        ab = mesdf[mesdf["status"].astype(str).str.strip().str.upper().isin(["ABERTO", "ABERTA"])].copy()
        if not ab.empty:
            ab["d"] = pd.to_datetime(ab["data_sos"], errors="coerce").dt.date
            etiquetas = ab.sort_values(["d", "hora_sos"]).reset_index(drop=True)
    etiquetas_total = int(len(etiquetas))
    etiquetas_antigas = int((etiquetas["d"] < hoje).sum()) if not etiquetas.empty else 0

    # ---- GNS / carros parados agora ----
    g = flr.processar_gns(ini_mes, hoje)

    # ---- Fila de SRs + abertas ontem ----
    sr = flr.processar_solicitacao_reparo(hoje)
    srdf = flr._fetch_all_rows(flr._sb_a(), "solicitacao_reparo",
                               "cd_reclamacao, dt_reclamacao, cs_situacao, ds_motivo_reclamacao")
    sr_ontem = pd.DataFrame()
    if not srdf.empty:
        srdf["dtr"] = pd.to_datetime(srdf["dt_reclamacao"], errors="coerce").dt.date
        sr_ontem = srdf[srdf["dtr"] == ontem]
    sr_abertas_ontem = int(len(sr_ontem))
    sr_motivos_ontem = (dict(sr_ontem["ds_motivo_reclamacao"].astype(str).str.strip().str.title()
                             .value_counts().head(3)) if not sr_ontem.empty else {})

    # ---- Planos vencidos hoje ----
    venc = flr.processar_planos_vencidos()

    # ---- Reincidência: válidas do DIA_REF e do dia seguinte × 7 dias anteriores ----
    base_rec = pd.DataFrame(flr.fetch_all_table_period(
        table_name="sos_acionamentos",
        select_fields="data_sos, veiculo, ocorrencia, problema_encontrado",
        date_field="data_sos", start_date=dia_ref - timedelta(days=7),
        end_date=min(dia_ref + timedelta(days=1), hoje)))
    reincidentes = []
    if not base_rec.empty:
        base_rec["d"] = pd.to_datetime(base_rec["data_sos"], errors="coerce").dt.date
        base_rec["valida"] = base_rec["ocorrencia"].apply(flr.is_ocorrencia_valida_para_mkbf)
        val = base_rec[base_rec["valida"]].copy()
        alvo = val[val["d"] >= dia_ref]
        for _, r in alvo.iterrows():
            antes = val[(val["veiculo"].astype(str) == str(r["veiculo"])) & (val["d"] < r["d"]) &
                        (val["d"] >= r["d"] - timedelta(days=7))]
            if not antes.empty:
                ant = antes.sort_values("d").iloc[-1]
                reincidentes.append({
                    "veiculo": str(r["veiculo"]),
                    "problema": _trunc(r["problema_encontrado"], 35),
                    "data": r["d"],
                    "problema_ant": _trunc(ant["problema_encontrado"], 35),
                    "data_ant": ant["d"],
                })

    # ---- Onda por setor (válidas de ONTEM) ----
    onda = None
    sos_ontem = pd.DataFrame(flr.fetch_all_table_period(
        table_name="sos_acionamentos", select_fields="data_sos, ocorrencia, setor_manutencao",
        date_field="data_sos", start_date=ontem, end_date=ontem))
    if not sos_ontem.empty:
        sos_ontem["valida"] = sos_ontem["ocorrencia"].apply(flr.is_ocorrencia_valida_para_mkbf)
        vo = sos_ontem[sos_ontem["valida"]]
        n_vo = int(len(vo))
        if n_vo >= 3:
            setores = vo["setor_manutencao"].astype(str).str.strip().replace({"": "N/D", "None": "N/D"})
            vc = setores.value_counts()
            if len(vc) and vc.iloc[0] / n_vo >= 0.60 and vc.index[0] not in ("N/D", "nan"):
                onda = {"setor": vc.index[0], "qtd": int(vc.iloc[0]), "total": n_vo}

    return {
        "hoje": hoje, "ontem": ontem, "ini_mes": ini_mes, "dia_ref": dia_ref,
        "km_dia": km_dia, "so": so, "validas_dia": validas_dia, "registros_dia": registros_dia,
        "seguiu_dia": seguiu_dia, "mkbf_dia": mkbf_dia,
        "km_mes": km_mes, "validas_mes": validas_mes, "mkbf_mes": mkbf_mes,
        "media_validas_dia": media_validas_dia, "dias_com_km": dias_com_km,
        "validas_pos": validas_pos,
        "regen_eventos": regen_eventos, "regen_custo": regen_custo, "regen_veiculos": regen_veiculos,
        "pv_dia": pv_dia, "pv_ontem_qtd": int(len(pv_ontem)), "prev_10k": prev_10k, "insp_5k": insp_5k,
        "prev_aguardando": prev_aguardando, "prev_ontem_aguardando": prev_ontem_aguardando,
        "prev_ultimo_lancado": prev_ultimo_lancado,
        "etiquetas": etiquetas, "etiquetas_total": etiquetas_total, "etiquetas_antigas": etiquetas_antigas,
        "gns": g, "sr": sr, "sr_abertas_ontem": sr_abertas_ontem, "sr_motivos_ontem": sr_motivos_ontem,
        "venc": venc, "reincidentes": reincidentes, "onda": onda,
    }


# ==============================================================================
# HTML (layout aprovado v5 — flash_diario.html)
# ==============================================================================
CSS = """
  *{box-sizing:border-box;}
  body{margin:0;font-family:Arial,Helvetica,sans-serif;background:#eef2f1;color:#132e2a;padding:24px 0;}
  @media (prefers-color-scheme:dark){body{background:#08201d;}}
  :root[data-theme="dark"] body{background:#08201d;}
  :root[data-theme="light"] body{background:#eef2f1;}
  .page{width:210mm;min-height:297mm;margin:0 auto 22px auto;background:#fff;padding:7mm 11mm;position:relative;box-shadow:0 20px 50px rgba(15,40,36,0.16);}
  .header{display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:4px;}
  .title h1{margin:0;font-size:23px;font-weight:900;letter-spacing:0.3px;color:#123b35;line-height:1.05;}
  .accent{color:#0d9488;}
  .title .sub{margin-top:5px;font-size:10.5px;color:#5b716c;}
  .period-box{min-width:150px;text-align:right;background:#0f3d38;color:#fff;padding:8px 16px;border-radius:10px;}
  .period-box .ref{font-size:9px;text-transform:uppercase;font-weight:700;letter-spacing:1px;opacity:0.7;}
  .period-box .val{font-size:17px;font-weight:800;margin-top:2px;}
  .accent-bar{height:6px;border-radius:4px;margin:6px 0 10px 0;background:linear-gradient(90deg,#0f3d38 0%,#0d9488 45%,#5eead4 100%);}
  .card{border:1px solid #d6e3e0;border-radius:12px;overflow:hidden;background:#fff;margin-bottom:7px;page-break-inside:avoid;}
  .card-title{padding:7px 13px;background:#0f3d38;color:#fff;font-size:11px;font-weight:800;text-transform:uppercase;letter-spacing:0.8px;}
  .card-title.red{background:#7f1d1d;}
  .card-body{padding:9px 12px;}
  .metric{border:1px solid #d6e3e0;border-radius:10px;padding:10px 8px;background:#fff;text-align:center;overflow:hidden;}
  .metric .lbl{font-size:8.5px;color:#5b716c;text-transform:uppercase;font-weight:800;letter-spacing:0.3px;white-space:nowrap;}
  .metric .val{margin-top:4px;font-size:19px;font-weight:900;color:#123b35;font-variant-numeric:tabular-nums;white-space:nowrap;}
  .metric .aux{margin-top:3px;font-size:8px;color:#5b716c;text-transform:uppercase;line-height:1.15;}
  .metric.red .val{color:#dc2626;} .metric.green .val{color:#0d9488;} .metric.grey .val{color:#94a3a0;}
  .metric.b-red{border-left:4px solid #dc2626;} .metric.b-teal{border-left:4px solid #0d9488;} .metric.b-amber{border-left:4px solid #d97706;}
  table{width:100%;border-collapse:collapse;font-size:10px;font-variant-numeric:tabular-nums;}
  th{background:#eef4f3;color:#123b35;text-transform:uppercase;font-size:8.5px;padding:6px 5px;border:1px solid #d6e3e0;text-align:center;}
  td{padding:5px 6px;border:1px solid #d6e3e0;text-align:center;}
  td.l{text-align:left;}
  .pill{display:inline-block;padding:2px 8px;border-radius:999px;font-size:8px;font-weight:800;text-transform:uppercase;}
  .pill.troca{background:#ccfbf1;color:#0f766e;} .pill.recolheu{background:#fee2e2;color:#991b1b;}
  .pill.sos{background:#fef3c7;color:#92400e;} .pill.avaria{background:#e0e7ff;color:#3730a3;}
  .pill.gns{background:#fee2e2;color:#991b1b;} .pill.pend{background:#fef3c7;color:#92400e;} .pill.gar{background:#dcfce7;color:#166534;}
  .grid4{display:grid;gap:8px;grid-template-columns:repeat(4,1fr);margin-bottom:8px;}
  .grid2{display:grid;gap:10px;grid-template-columns:1fr 1fr;}
  .grid2w{display:grid;gap:10px;grid-template-columns:1.25fr 1fr;}
  .cons-box{margin-top:7px;border:1px solid #d6e3e0;border-radius:12px;background:#f6faf9;padding:9px 11px;page-break-inside:avoid;}
  .cons-title{font-size:11px;font-weight:800;text-transform:uppercase;margin-bottom:5px;color:#123b35;letter-spacing:0.6px;}
  .cons-text{font-size:10.5px;line-height:1.42;color:#1f3a35;text-align:justify;}
  .footer{position:absolute;left:11mm;right:11mm;bottom:6mm;font-size:9.5px;color:#5b716c;display:flex;justify-content:space-between;border-top:1px solid #d6e3e0;padding-top:5px;}
  .muted{color:#94a3a0;} .red{color:#dc2626;} .teal{color:#0d9488;}
  .bar-wrap{background:#eef4f3;border-radius:5px;height:12px;overflow:hidden;position:relative;flex:1;}
  .bar{position:absolute;left:0;top:0;height:100%;border-radius:5px;background:#0d9488;}
  .bucket-row{display:flex;align-items:center;gap:6px;font-size:9px;margin-bottom:4px;}
  .bucket-row .lb{min-width:52px;font-weight:700;color:#5b716c;} .bucket-row .n{min-width:22px;text-align:right;font-weight:800;}
  .alert-item{display:flex;gap:8px;align-items:flex-start;padding:6px 0;border-bottom:1px dashed #f1d5d5;font-size:10.5px;line-height:1.4;}
  .alert-item:last-child{border-bottom:none;}
  table.compact td{padding:2.5px 5px;font-size:9px;}
  table.compact th{padding:4px;font-size:8px;}
  .alert-dot{width:8px;height:8px;border-radius:99px;background:#dc2626;margin-top:4px;flex:none;}
  .page-break{page-break-before:always;}
  @page{size:A4;margin:0;}
  @media print{
    body{padding:0 !important;background:#fff !important;}
    .page{margin:0 !important;box-shadow:none !important;min-height:293mm !important;max-height:296mm !important;overflow:hidden !important;page-break-after:always;break-after:page;page-break-inside:avoid;}
    .page:last-of-type{page-break-after:auto;break-after:auto;}
    .page-break{display:none !important;height:0 !important;}
  }
"""


def _fmt(v):
    return flr._fmt_int(v)


def gerar_html(d: dict) -> str:
    hoje, dia_ref, ontem = d["hoje"], d["dia_ref"], d["ontem"]
    g, sr, venc = d["gns"], d["sr"], d["venc"]

    # ---------- PÁGINA 1 ----------
    mkbf_dia_cls = "green" if d["mkbf_dia"] >= MKBF_META else "red"
    mkbf_dia_aux = f"acima da meta ({_fmt(MKBF_META)})" if d["mkbf_dia"] >= MKBF_META else f"abaixo da meta ({_fmt(MKBF_META)})"

    if d["so"].empty or d["validas_dia"] == 0:
        rows_dia = '<tr><td colspan="6" class="muted">Nenhuma intervenção válida no dia</td></tr>'
    else:
        rows_dia = "".join(
            f'<tr><td>{_hhmm(r["hora_sos"])}</td><td><b>{r["veiculo"]}</b></td><td>{r["linha"] or "—"}</td>'
            f'<td>{_pill_tipo(r["tipo"])}</td><td class="l">{_trunc(r["problema_encontrado"], 45)}</td>'
            f'<td>{_trunc(r["setor_manutencao"], 14)}</td></tr>'
            for _, r in d["so"][d["so"]["valida"]].sort_values("hora_sos").iterrows()
        )

    dia_leve = d["validas_dia"] <= d["media_validas_dia"]
    nota_dia = (
        f'+ {d["seguiu_dia"]} SEGUIU VIAGEM (não contam no MKBF). '
        f'Dia {"leve" if dia_leve else "pesado"}: {d["validas_dia"]} válidas contra a média de '
        f'{d["media_validas_dia"]:.1f}/dia do mês.'.replace(".", ",")
    )
    if d["validas_pos"] > 0:
        nota_dia += (f' <b>Nos dias após {_ddmm(dia_ref)} já há {d["validas_pos"]} válidas registradas</b> — '
                     f'entram no MKBF quando o KM consolidar (lag de ~2 dias do TransNet).')
    if d["etiquetas_total"] > 0:
        nota_dia += (f' <b class="red">Atenção: ainda há {d["etiquetas_total"]} etiquetas em aberto</b> (pág. 2) — '
                     f'quando forem classificadas, o nº de válidas dos dias pode mudar.')

    if d["regen_eventos"] == 0:
        regen_body = (
            '<div style="font-size:26px;font-weight:900;color:#0d9488;margin:6px 0 2px;">0</div>'
            '<div style="font-size:9px;color:#5b716c;text-transform:uppercase;">eventos de regeneração registrados</div>'
            f'<div style="margin-top:6px;font-size:9.5px;color:#5b716c;">Nenhuma queima de diesel em regeneração no dia {_ddmm(dia_ref)} — dia limpo no DPF.</div>'
        )
    else:
        regen_body = (
            f'<div style="font-size:26px;font-weight:900;color:#dc2626;margin:6px 0 2px;">{d["regen_eventos"]}</div>'
            '<div style="font-size:9px;color:#5b716c;text-transform:uppercase;">eventos de regeneração registrados</div>'
            f'<div style="margin-top:6px;font-size:9.5px;color:#5b716c;">R$ {_fmt(d["regen_custo"])} de diesel queimado em '
            f'{d["regen_veiculos"]} veículo(s) no dia {_ddmm(dia_ref)} — regeneração frequente é alarme de quebra.</div>'
        )

    ultimo_lanc = d.get("prev_ultimo_lancado")
    if d["prev_aguardando"]:
        # Dado ainda não importado — NÃO afirmar que nada foi feito.
        rows_prev = ('<tr><td colspan="2" class="muted">Lançamento ainda não importado '
                     'para este dia</td></tr>')
        nota_prev = (f'⏳ A base de preventivas está lançada até <b>{_ddmm_str(ultimo_lanc)}</b> — '
                     f'o que foi feito em {_ddmm(dia_ref)} ainda não entrou no sistema '
                     f'(lançamento costuma atrasar ~2 dias). <b>Não significa que não foi feito.</b>')
    elif d["pv_dia"].empty:
        rows_prev = '<tr><td colspan="2" class="muted">Nenhuma preventiva lançada no dia</td></tr>'
        nota_prev = (f'Nenhuma preventiva registrada em {_ddmm(dia_ref)}'
                     + (f' — com <b>{venc["total_vencidos"]} planos vencidos</b>, conferir a programação.'
                        if venc.get("total_vencidos", 0) > 0 else '.'))
    else:
        rows_prev = "".join(
            f'<tr><td><b>{r["prefixo"]}</b></td><td class="l">{_trunc(r["tipo"], 40)}</td></tr>'
            for _, r in d["pv_dia"].iterrows()
        )
        if d["prev_ontem_aguardando"]:
            nota_prev = (f'Ontem ({_ddmm(ontem)}): lançamento ainda não importado '
                         f'(base vai até {_ddmm_str(ultimo_lanc)}).')
        elif d["pv_ontem_qtd"] == 0 and venc.get("total_vencidos", 0) > 0:
            nota_prev = (f'Ontem ({_ddmm(ontem)}): nenhuma lançada — com <b>{venc["total_vencidos"]} planos vencidos</b>, '
                         f'conferir a programação.')
        else:
            nota_prev = f'Ontem ({_ddmm(ontem)}): {d["pv_ontem_qtd"]} preventiva(s) lançada(s).'

    # Leitura do dia (dinâmica, sem IA)
    rein_txt = ""
    rein_dia_ref = [r for r in d["reincidentes"] if r["data"] == dia_ref]
    if rein_dia_ref:
        r0 = rein_dia_ref[0]
        rein_txt = (f' Destaque de atenção: o <b>{r0["veiculo"]} quebrou de {r0["problema"]}</b> e já tinha quebrado '
                    f'dia {_ddmm(r0["data_ant"])} ({r0["problema_ant"]}) — reincidente na semana.')
    pos_txt = ""
    if d["validas_pos"] > 0:
        pos_txt = (f' Nos dias seguintes já há <b>{d["validas_pos"]} válidas registradas</b> — '
                   f'entram na conta quando o KM consolidar.')
    leitura = (
        f'{_dia_semana(dia_ref).capitalize()} {_ddmm(dia_ref)} foi um <b>dia {"bom" if dia_leve else "pesado"}</b>: '
        f'{"só " if dia_leve else ""}<b>{d["validas_dia"]} intervenções válidas</b> com {_fmt(d["km_dia"])} km rodados — '
        f'<b>MKBF do dia de {_fmt(d["mkbf_dia"])}, {"acima" if d["mkbf_dia"] >= MKBF_META else "abaixo"} da meta</b>.'
        f'{rein_txt} Acumulado do mês (01–{_ddmm(dia_ref)}): <b>MKBF {_fmt(d["mkbf_mes"])}</b> contra meta {_fmt(MKBF_META)}.'
        f'{pos_txt}'
    )

    pagina1 = f"""
<div class="page">
  <div class="header">
    <div class="title">
      <h1>O DIA · <span class="accent">{_dia_semana(dia_ref)} {_ddmm(dia_ref)}</span></h1>
      <div class="sub">Flash Diário de Manutenção · Quatai · último dia com KM consolidado</div>
    </div>
    <div class="period-box"><div class="ref">Hoje</div><div class="val">{_dia_abrev(hoje)} · {hoje.strftime("%d/%m/%Y")}</div></div>
  </div>
  <div class="accent-bar"></div>

  <div class="grid4">
    <div class="metric b-teal"><div class="lbl">Intervenções válidas</div><div class="val">{d["validas_dia"]}</div><div class="aux">{d["registros_dia"]} registros no dia</div></div>
    <div class="metric"><div class="lbl">KM rodado no dia</div><div class="val">{_fmt(d["km_dia"])}</div><div class="aux">frota toda · {_ddmm(dia_ref)}</div></div>
    <div class="metric {mkbf_dia_cls}"><div class="lbl">MKBF do dia</div><div class="val">{_fmt(d["mkbf_dia"])}</div><div class="aux">{mkbf_dia_aux}</div></div>
    <div class="metric b-amber"><div class="lbl">MKBF do mês</div><div class="val">{_fmt(d["mkbf_mes"])}</div><div class="aux">01–{_ddmm(dia_ref)} · meta {_fmt(MKBF_META)}</div></div>
  </div>

  <div class="card">
    <div class="card-title">Intervenções do dia {_ddmm(dia_ref)} — {d["validas_dia"]} válidas</div>
    <div class="card-body">
      <table>
        <thead><tr><th>Hora</th><th>Carro</th><th>Linha</th><th>Tipo</th><th>Problema</th><th>Setor</th></tr></thead>
        <tbody>{rows_dia}</tbody>
      </table>
      <div style="margin-top:6px;font-size:9px;color:#5b716c;">{nota_dia}</div>
    </div>
  </div>

  <div class="grid2">
    <div class="card">
      <div class="card-title">Regenerações no dia</div>
      <div class="card-body" style="text-align:center;">{regen_body}</div>
    </div>
    <div class="card">
      <div class="card-title">Preventivas realizadas no dia</div>
      <div class="card-body">
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:7px;">
          <div class="metric"><div class="lbl">Preventiva 10.000</div><div class="val" style="color:{'#94a3a0' if (d["prev_aguardando"] or not d["prev_10k"]) else '#123b35'};font-size:{'12px' if d["prev_aguardando"] else '19px'};">{'aguardando' if d["prev_aguardando"] else d["prev_10k"]}</div></div>
          <div class="metric b-teal"><div class="lbl">Inspeção 5.000</div><div class="val" style="color:{'#94a3a0' if (d["prev_aguardando"] or not d["insp_5k"]) else '#123b35'};font-size:{'12px' if d["prev_aguardando"] else '19px'};">{'aguardando' if d["prev_aguardando"] else d["insp_5k"]}</div></div>
        </div>
        <table>
          <thead><tr><th>Carro</th><th>Plano</th></tr></thead>
          <tbody>{rows_prev}</tbody>
        </table>
        <div style="margin-top:6px;font-size:9px;color:#5b716c;">{nota_prev}</div>
      </div>
    </div>
  </div>

  <div class="cons-box">
    <div class="cons-title">Leitura do dia</div>
    <div class="cons-text">{leitura}</div>
  </div>

  <div class="footer"><div>Flash Diário · gerado automaticamente · dados reais</div><div>Página 1/2 · Manutenção — Quatai</div></div>
</div>
"""

    # ---------- PÁGINA 2 ----------
    parados = g["df_parados"].head(8) if not g["df_parados"].empty else pd.DataFrame()
    n_resto = max(0, g["total_parado"] - len(parados))
    if parados.empty:
        rows_parados = '<tr><td colspan="5" class="muted">Sem carros parados na sessão mais recente</td></tr>'
    else:
        rows_parados = ""
        for _, r in parados.iterrows():
            dias = int(r.get("dias_parado") or 0)
            dcls = ' class="red"' if dias >= 30 else ""
            rows_parados += (
                f'<tr><td><b>{r.get("frota","")}</b></td><td>{_pill_categoria(r.get("categoria"))}</td>'
                f'<td>{_setor_abrev(r.get("setor"))}</td><td class="l">{_trunc(r.get("descricao"), 40)}</td>'
                f'<td{dcls}><b>{dias}</b></td></tr>'
            )

    rows_setor = "".join(
        f'<tr><td class="l"><b>{k}</b></td><td{" class=\'red\'" if "SUPRIM" in str(k).upper() else ""}><b>{v}</b></td></tr>'
        for k, v in sorted(g["por_setor"].items(), key=lambda x: -x[1])
    ) or '<tr><td colspan="2" class="muted">Sem dados</td></tr>'

    # Etiquetas em aberto — TODAS as rows
    if d["etiquetas"].empty:
        rows_etq = '<tr><td colspan="4" class="muted">Nenhuma etiqueta em aberto</td></tr>'
        nota_etq = "Sem pendências de classificação."
    else:
        rows_etq = ""
        for _, r in d["etiquetas"].iterrows():
            if r["d"] == hoje:
                desde = f'hoje {_hhmm(r["hora_sos"])}'
                cell = f'<td>{desde}</td>'
            else:
                dias_e = (hoje - r["d"]).days
                txt = f'{r["d"].strftime("%d/%m")} · {dias_e}d'
                cell = f'<td class="red"><b>{txt}</b></td>' if dias_e >= 5 else f'<td class="red">{txt}</td>'
            linha = str(r.get("linha") or "").strip() or "—"
            rows_etq += (f'<tr><td><b>{r["numero_sos"]}</b></td><td>{r["veiculo"]}</td>'
                         f'<td>{linha}</td>{cell}</tr>')
        if d["etiquetas_antigas"] > 0:
            mais_antiga = d["etiquetas"].iloc[0]
            dias_ma = (hoje - mais_antiga["d"]).days
            nota_etq = (f'As {d["etiquetas_antigas"]} primeiras são de dias anteriores — a '
                        f'<b>{mais_antiga["numero_sos"]} já tem {dias_ma} dia(s)</b>. '
                        f'As {d["etiquetas_total"] - d["etiquetas_antigas"]} de hoje são a triagem do dia.')
        else:
            nota_etq = f'Todas as {d["etiquetas_total"]} etiquetas são de hoje — triagem do dia em andamento.'

    # Fila de SRs — envelhecimento (6 buckets)
    labs = ["1-5", "6-10", "11-15", "16-20", "21-59", ">60"]
    labs_show = ["1–5 dias", "6–10", "11–15", "16–20", "21–59", "&gt;60"]
    buckets = sr.get("buckets_aberto", {}) or {}
    vals = [int(buckets.get(k, 0)) for k in labs]
    max_b = max(vals) if any(vals) else 1
    rows_bucket = ""
    for i, k in enumerate(labs):
        red = i >= 4
        w = round(vals[i] / max_b * 100)
        bar_style = f'width:{w}%;' + ("background:#dc2626;" if red else "")
        n_cls = ' red' if red else ''
        rows_bucket += (f'<div class="bucket-row"><span class="lb">{labs_show[i]}</span>'
                        f'<div class="bar-wrap"><div class="bar" style="{bar_style}"></div></div>'
                        f'<span class="n{n_cls}">{vals[i]}</span></div>')
    motivos_txt = " · ".join(f"{k} {v}" for k, v in d["sr_motivos_ontem"].items())
    nota_sr = (f'Abertas ontem: <b>{d["sr_abertas_ontem"]}</b>'
               + (f' ({motivos_txt})' if motivos_txt else "")
               + f'. Mais antiga na fila: <b class="red">{sr.get("mais_antiga_dias", 0)} dias</b>.')

    # Alertas
    alertas = []
    if d["reincidentes"]:
        partes = [
            (f'<b>{r["veiculo"]}</b> quebrou de <b>{r["problema"]}</b> dia {_ddmm(r["data"])} e já tinha quebrado '
             f'dia <b>{_ddmm(r["data_ant"])} ({r["problema_ant"]})</b>')
            for r in d["reincidentes"][:3]
        ]
        alertas.append(" · ".join(partes) + " — reinspeção antes de liberar (regra dos 4 olhos).")
    if d["onda"]:
        o = d["onda"]
        alertas.append(f'<b>Onda de {o["setor"]}:</b> {o["qtd"]} das {o["total"]} quebras válidas de ontem '
                       f'saíram do mesmo setor — conferir componente/lote em comum.')
    if not g["df_parados"].empty:
        ma = g["df_parados"].iloc[0]
        alertas.append(f'<b>{ma.get("frota","")}</b> completa <b>{int(ma.get("dias_parado") or 0)} dias parado</b> '
                       f'({_setor_abrev(ma.get("setor"))}) — maior ofensor de disponibilidade da frota.')
    if not alertas:
        alertas.append("Sem alertas de reincidência ou onda por setor hoje.")
    rows_alertas = "".join(f'<div class="alert-item"><div class="alert-dot"></div><div>{a}</div></div>' for a in alertas)

    # Prioridades da manhã (dinâmica)
    prios = []
    if d["reincidentes"]:
        carros = ", ".join(sorted({r["veiculo"] for r in d["reincidentes"]}))
        prios.append(f'Reinspecionar <b>{carros}</b> (reincidente{"s" if len(d["reincidentes"]) > 1 else ""}) antes de voltar pra linha')
    if d["etiquetas_antigas"] > 0:
        prios.append(f'Classificar as <b>{d["etiquetas_antigas"]} etiquetas antigas</b> — distorcem o MKBF')
    if d["onda"]:
        prios.append(f'Investigar a <b>onda de {d["onda"]["setor"]}</b> ({d["onda"]["qtd"]} de {d["onda"]["total"]} válidas de ontem)')
    if venc.get("total_vencidos", 0) > 0:
        extra = " — nenhuma preventiva foi concluída ontem" if d["pv_ontem_qtd"] == 0 else ""
        prios.append(f'Programar os <b>{venc["total_vencidos"]} planos vencidos</b>{extra}')
    travados_pecas = int(sum(v for k, v in g["por_setor"].items() if "SUPRIM" in str(k).upper()))
    if travados_pecas > 0 and not g["df_parados"].empty:
        ma = g["df_parados"].iloc[0]
        prios.append(f'Cobrar Suprimentos: <b>{travados_pecas} carros travados por peça</b>, '
                     f'{ma.get("frota","")} no topo com {int(ma.get("dias_parado") or 0)}d')
    if not prios:
        prios.append("Sem pendências críticas — manter rotina de triagem e programação")
    prioridades = " ".join(f'{i+1}) {p}.' for i, p in enumerate(prios))

    pagina2 = f"""
<div class="page">
  <div class="header">
    <div class="title">
      <h1>A MANHÃ DE HOJE · <span class="accent">{_dia_semana(hoje)} {_ddmm(hoje)}</span></h1>
      <div class="sub">Como a operação amanhece · GNS, filas e alertas</div>
    </div>
    <div class="period-box"><div class="ref">Parados agora</div><div class="val">{g["total_parado"]} carros</div></div>
  </div>
  <div class="accent-bar"></div>

  <div class="grid4">
    <div class="metric b-red"><div class="lbl">Parados agora</div><div class="val">{g["total_parado"]}</div><div class="aux">sessão PCM mais recente</div></div>
    <div class="metric"><div class="lbl">GNS médio do mês</div><div class="val">{f'{g["gns_medio"]:.1f}'.replace(".", ",")}</div><div class="aux">por dia útil</div></div>
    <div class="metric b-amber"><div class="lbl">Fila de SRs</div><div class="val">{sr.get("aberto_total", 0)}</div><div class="aux">não atendidas · +{d["sr_abertas_ontem"]} ontem</div></div>
    <div class="metric red"><div class="lbl">Planos vencidos</div><div class="val">{venc.get("total_vencidos", 0)}</div><div class="aux">acuracidade {f'{venc.get("acuracidade_pct", 0):.1f}'.replace(".", ",")}%</div></div>
  </div>

  <div class="grid2w">
    <div class="card">
      <div class="card-title">Carros parados — mais antigos</div>
      <div class="card-body">
        <table>
          <thead><tr><th>Carro</th><th>Cat.</th><th>Setor</th><th>Motivo</th><th>Dias</th></tr></thead>
          <tbody>{rows_parados}</tbody>
        </table>
        <div style="margin-top:5px;font-size:9px;color:#94a3a0;">+ {n_resto} carros parados há menos tempo</div>
      </div>
    </div>
    <div>
      <div class="card">
        <div class="card-title">Por setor</div>
        <div class="card-body"><table><tbody>{rows_setor}</tbody></table></div>
      </div>
      <div class="card">
        <div class="card-title red">Etiquetas em aberto ({d["etiquetas_total"]})</div>
        <div class="card-body">
          <table class="compact">
            <thead><tr><th>Nº</th><th>Carro</th><th>Linha</th><th>Desde</th></tr></thead>
            <tbody>{rows_etq}</tbody>
          </table>
          <div style="margin-top:5px;font-size:9px;color:#5b716c;">{nota_etq}</div>
        </div>
      </div>
    </div>
  </div>

  <div class="grid2">
    <div class="card">
      <div class="card-title">Fila de SRs — envelhecimento</div>
      <div class="card-body">
        {rows_bucket}
        <div style="margin-top:6px;font-size:9px;color:#5b716c;">{nota_sr}</div>
      </div>
    </div>
    <div class="card">
      <div class="card-title red">⚠ Alertas de hoje</div>
      <div class="card-body">{rows_alertas}</div>
    </div>
  </div>

  <div class="cons-box">
    <div class="cons-title">Prioridades da manhã</div>
    <div class="cons-text">{prioridades}</div>
  </div>

  <div class="footer"><div>Flash Diário · gerado automaticamente · dados reais</div><div>Página 2/2 · Manutenção — Quatai</div></div>
</div>
"""

    return (f'<!DOCTYPE html>\n<html lang="pt-BR">\n<head>\n<meta charset="UTF-8" />\n'
            f'<title>Flash Diário Manutenção — {hoje.strftime("%d/%m/%Y")}</title>\n'
            f'<style>{CSS}</style>\n</head>\n<body>\n{pagina1}\n<div class="page-break"></div>\n{pagina2}\n</body>\n</html>\n')


# ==============================================================================
# RENDER (playwright → screenshot por página)
# ==============================================================================
def renderizar(html_path: Path, out_dir: Path) -> list[Path]:
    pngs = []
    with sync_playwright() as p:
        browser = p.chromium.launch(args=["--no-sandbox"])
        page = browser.new_page(viewport={"width": 1000, "height": 1400}, device_scale_factor=2)
        page.goto(html_path.resolve().as_uri(), wait_until="networkidle")
        page.wait_for_timeout(300)

        pages = page.locator(".page")
        n = pages.count()
        for i in range(n):
            el = pages.nth(i)
            box = el.bounding_box()
            print(f"📐 .page[{i+1}] bounding box: {box['width']:.0f} x {box['height']:.0f}px")
            out = out_dir / f"diario_pg{i+1}.png"
            el.screenshot(path=str(out), scale="device")
            pngs.append(out)

        # PDF opcional (mesmo HTML)
        try:
            page.emulate_media(media="print")
            page.pdf(path=str(out_dir / "diario.pdf"), format="A4", print_background=True,
                     margin={"top": "0mm", "right": "0mm", "bottom": "0mm", "left": "0mm"},
                     prefer_css_page_size=True)
        except Exception as e:
            print("⚠️ PDF opcional falhou:", repr(e))
        browser.close()
    return pngs


# ==============================================================================
# TELEGRAM
# ==============================================================================
def _telegram_creds():
    token = os.getenv("TELEGRAM_BOT_TOKEN") or os.getenv("TELEGRAM_TOKEN")
    chat_id = os.getenv("TELEGRAM_CHAT_ID")
    if not token or not chat_id:
        fallback = Path(r"C:\Users\Guilh\Repositorios\Sistemas\PONTO\importador_supabase\_telegram.json")
        if fallback.exists():
            try:
                cfg = json.loads(fallback.read_text(encoding="utf-8"))
                token = token or cfg.get("token")
                chat_id = chat_id or cfg.get("chat_id")
            except Exception as e:
                print("⚠️ Falha ao ler fallback do Telegram:", repr(e))
    return token, chat_id


def montar_caption(d: dict) -> str:
    hoje, dia_ref = d["hoje"], d["dia_ref"]
    g, sr, venc = d["gns"], d["sr"], d["venc"]

    mkbf_dia_txt = _fmt(d["mkbf_dia"]) + (", acima da meta!" if d["mkbf_dia"] >= MKBF_META else "")

    carro_ma, dias_ma = "—", 0
    if not g["df_parados"].empty:
        ma = g["df_parados"].iloc[0]
        carro_ma, dias_ma = str(ma.get("frota", "—")), int(ma.get("dias_parado") or 0)

    # alertas curtos
    partes_alerta = []
    if d["reincidentes"]:
        carros = ", ".join(sorted({r["veiculo"] for r in d["reincidentes"]}))
        partes_alerta.append(f"reincidentes na semana: <b>{carros}</b> — reinspeção antes de liberar")
    if d["onda"]:
        o = d["onda"]
        partes_alerta.append(f"onda de <b>{o['setor']}</b> ({o['qtd']} de {o['total']} válidas de ontem)")
    alertas_txt = " · ".join(partes_alerta) if partes_alerta else "sem alertas de reincidência ou onda hoje"

    return (
        f"🔧 <b>FLASH DIÁRIO · MANUTENÇÃO</b> — {_dia_semana(hoje).lower()} {_ddmm(hoje)}"
        f"\n\n"
        f"📊 <b>Dia {_ddmm(dia_ref)}</b> (último c/ KM): {d['validas_dia']} quebras válidas em "
        f"{_fmt(d['km_dia'])} km → <b>MKBF do dia {mkbf_dia_txt}</b>. Mês: {_fmt(d['mkbf_mes'])} (meta {_fmt(MKBF_META)})."
        f"\n\n"
        f"🚨 <b>Hoje:</b> {g['total_parado']} carros parados ({carro_ma} há {dias_ma}d) · "
        f"fila de {sr.get('aberto_total', 0)} SRs (+{d['sr_abertas_ontem']} ontem) · "
        f"{venc.get('total_vencidos', 0)} planos vencidos."
        f"\n\n"
        f"⚠️ {alertas_txt}."
        f"\n\n"
        f"🏷️ {d['etiquetas_total']} etiquetas em aberto ({d['etiquetas_antigas']} antigas p/ classificar)"
        f"\n"
        + (
            f"⏳ Preventivas de {_ddmm(dia_ref)}: lançamento ainda não importado "
            f"(base até {_ddmm_str(d.get('prev_ultimo_lancado'))})."
            if d.get("prev_aguardando")
            else f"✅ Dia {_ddmm(dia_ref)}: {d['insp_5k']} Inspeções de 5.000 · {d['prev_10k']} Preventivas de 10.000."
        )
    )


def enviar_telegram(pngs: list[Path], caption: str):
    if os.getenv("TELEGRAM_DRY_RUN") == "1":
        print("🧪 TELEGRAM_DRY_RUN=1 — não enviando. Caption abaixo:")
        print("---------------- CAPTION ----------------")
        print(caption)
        print("------------------------------------------")
        return

    import requests
    token, chat_id = _telegram_creds()
    if not token or not chat_id:
        raise RuntimeError("Credenciais do Telegram ausentes (TELEGRAM_BOT_TOKEN/TELEGRAM_CHAT_ID).")

    media = []
    files = {}
    for i, png in enumerate(pngs[:10]):
        key = f"pg{i+1}"
        item = {"type": "photo", "media": f"attach://{key}"}
        if i == 0:
            item["caption"] = caption
            item["parse_mode"] = "HTML"
        media.append(item)
        files[key] = (png.name, png.read_bytes(), "image/png")

    resp = requests.post(
        f"https://api.telegram.org/bot{token}/sendMediaGroup",
        data={"chat_id": chat_id, "media": json.dumps(media)},
        files=files, timeout=120,
    )
    if not resp.ok:
        raise RuntimeError(f"Telegram sendMediaGroup falhou: {resp.status_code} {resp.text[:400]}")
    print("✅ Enviado no Telegram (sendMediaGroup, 2 fotos).")


# ==============================================================================
# WHATSAPP PESSOAL (CallMeBot: texto + links das imagens)
# Sobe as imagens num bucket publico do Supabase (pasta com sufixo aleatorio,
# nao adivinhavel) e manda o texto com os links via CallMeBot. Tudo opcional:
# sem CALLMEBOT_PHONE/CALLMEBOT_APIKEY nao faz nada; sem STORAGE_* vai so o texto.
# ==============================================================================
def enviar_whatsapp_callmebot(texto, arquivos, slug):
    import time
    import uuid

    import requests

    phone = os.environ.get("CALLMEBOT_PHONE", "")
    apikey = os.environ.get("CALLMEBOT_APIKEY", "")
    if not (phone and apikey):
        return
    st_url = os.environ.get("STORAGE_SUPABASE_URL", "").rstrip("/")
    st_key = os.environ.get("STORAGE_SUPABASE_KEY", "")
    bucket = os.environ.get("STORAGE_BUCKET", "flash-reports")

    links = []
    if st_url and st_key:
        pasta = f"{slug}/{date.today().isoformat()}-{uuid.uuid4().hex[:8]}"
        for arq in arquivos:
            p = str(arq)
            if not os.path.exists(p):
                continue
            nome = os.path.basename(p)
            with open(p, "rb") as fh:
                r = requests.post(f"{st_url}/storage/v1/object/{bucket}/{pasta}/{nome}",
                                  headers={"Authorization": f"Bearer {st_key}", "x-upsert": "true",
                                           "Content-Type": "image/png"},
                                  data=fh.read(), timeout=120)
            if r.status_code in (200, 201):
                links.append(f"{st_url}/storage/v1/object/public/{bucket}/{pasta}/{nome}")
            else:
                print("whats: upload falhou:", nome, r.status_code, r.text[:200])

    if links:
        texto += "\n\n📷 Imagens:\n" + "\n".join(links)

    # CallMeBot tem rate limit; a 2a tentativa espacada cobre colisao de horario com outro bot.
    for tentativa in (1, 2):
        try:
            r = requests.get("https://api.callmebot.com/whatsapp.php",
                             params={"phone": phone, "apikey": apikey, "text": texto}, timeout=120)
            print(f"whats callmebot ({tentativa}):", r.status_code, r.text[:120].replace("\n", " "))
            if r.ok:
                return
        except Exception as e:
            print(f"whats callmebot ({tentativa}) erro:", e)
        if tentativa == 1:
            time.sleep(65)


# ==============================================================================
# MAIN
# ==============================================================================
def main():
    PASTA_SAIDA.mkdir(parents=True, exist_ok=True)

    print("🔧 Flash Diário de Manutenção — coletando dados...")
    d = coletar_dados()

    html = gerar_html(d)
    html_path = PASTA_SAIDA / "flash_diario.html"
    html_path.write_text(html, encoding="utf-8")
    print(f"✅ HTML salvo: {html_path}")

    pngs = renderizar(html_path, PASTA_SAIDA)
    for p in pngs:
        print(f"🖼️ {p} ({p.stat().st_size / 1024:.0f} KB)")

    caption = montar_caption(d)
    enviar_telegram(pngs, caption)
    if os.getenv("TELEGRAM_DRY_RUN") != "1":
        try:
            texto_wa = caption.replace("<b>", "*").replace("</b>", "*")
            enviar_whatsapp_callmebot(texto_wa, pngs, "manutencao-diario")
        except Exception:
            import traceback
            print("CALLMEBOT falhou (Telegram ja foi):")
            traceback.print_exc()
    print("✅ [OK] Flash Diário concluído.")


if __name__ == "__main__":
    main()
