# scripts/flash_report_manutencao.py
# ------------------------------------------------------------------------------
# FLASH REPORT MANUTENÇÃO - PÁGINAS 1, 2, 3 E 4
# ------------------------------------------------------------------------------

import os
import re
from datetime import datetime, date, timedelta
from pathlib import Path

import pandas as pd
import matplotlib.pyplot as plt

from supabase import create_client
from playwright.sync_api import sync_playwright

# IA opcional
try:
    import vertexai
    from vertexai.generative_models import GenerativeModel
    from google.auth.exceptions import DefaultCredentialsError
except Exception:
    vertexai = None
    GenerativeModel = None

    class DefaultCredentialsError(Exception):
        pass


# ==============================================================================
# CONFIG
# ==============================================================================
SUPABASE_B_URL = os.getenv("SUPABASE_B_URL")
SUPABASE_B_SERVICE_ROLE_KEY = os.getenv("SUPABASE_B_SERVICE_ROLE_KEY")

# Origem do KM rodado (tabela indicadores_diesel)
SUPABASE_A_URL = os.getenv("SUPABASE_A_URL")
SUPABASE_A_SERVICE_ROLE_KEY = os.getenv("SUPABASE_A_SERVICE_ROLE_KEY")

REPORT_ID = os.getenv("REPORT_ID", "")
REPORT_TIPO = os.getenv("REPORT_TIPO", "flash_report_manutencao")
REPORT_PERIODO_INICIO = os.getenv("REPORT_PERIODO_INICIO")
REPORT_PERIODO_FIM = os.getenv("REPORT_PERIODO_FIM")

PASTA_SAIDA = os.getenv("REPORT_OUTPUT_DIR", "Relatorios_Manutencao")
BUCKET_RELATORIOS = os.getenv("REPORT_BUCKET", "relatorios")
REMOTE_BASE_PREFIX = os.getenv("REPORT_REMOTE_PREFIX", "manutencao")

REPORT_PAGE_SIZE = int(os.getenv("REPORT_PAGE_SIZE", "1000"))
REPORT_MAX_ROWS = int(os.getenv("REPORT_MAX_ROWS", "200000"))

MKBF_META = float(os.getenv("MKBF_META", "7000"))

# IA opcional
VERTEX_PROJECT_ID = os.getenv("VERTEX_PROJECT_ID") or os.getenv("PROJECT_ID")
VERTEX_LOCATION = os.getenv("VERTEX_LOCATION", "us-central1")
VERTEX_MODEL = os.getenv("VERTEX_MODEL", "gemini-2.5-pro")
VERTEX_SA_JSON = os.getenv("VERTEX_SA_JSON")


# ==============================================================================
# HELPERS BASE
# ==============================================================================
def _assert_env():
    missing = []
    for k in [
        "SUPABASE_B_URL", "SUPABASE_B_SERVICE_ROLE_KEY",
        "SUPABASE_A_URL", "SUPABASE_A_SERVICE_ROLE_KEY",
    ]:
        if not os.getenv(k):
            missing.append(k)
    if missing:
        raise RuntimeError(f"Variáveis obrigatórias ausentes: {missing}")


def _parse_iso(d: str | None) -> date | None:
    if not d:
        return None
    return datetime.strptime(d, "%Y-%m-%d").date()


def _sb_b():
    return create_client(SUPABASE_B_URL, SUPABASE_B_SERVICE_ROLE_KEY)


def _sb_a():
    return create_client(SUPABASE_A_URL, SUPABASE_A_SERVICE_ROLE_KEY)


def atualizar_status_relatorio(status: str, **fields):
    if not REPORT_ID:
        return
    sb = _sb_b()
    payload = {"status": status, **fields}
    sb.table("relatorios_gerados").update(payload).eq("id", REPORT_ID).execute()


def upload_storage_b(local_path: Path, remote_path: str, content_type: str) -> int:
    sb = _sb_b()
    storage = sb.storage.from_(BUCKET_RELATORIOS)
    data = local_path.read_bytes()
    storage.upload(
        path=remote_path,
        file=data,
        file_options={"content-type": content_type, "upsert": "true"},
    )
    return len(data)


def _fmt_br_date(d: date | None) -> str:
    if not d:
        return ""
    return d.strftime("%d/%m/%Y")


def _fmt_int(v):
    try:
        return f"{int(round(float(v))):,}".replace(",", ".")
    except Exception:
        return "0"


def _fmt_pct(v):
    try:
        return f"{float(v):+.1f}%"
    except Exception:
        return "0,0%"


def _parse_number(v):
    if v is None:
        return None

    if isinstance(v, (int, float)):
        return float(v)

    s = str(v).strip()
    if not s:
        return None

    if "," in s and "." in s:
        s = s.replace(".", "").replace(",", ".")
        try:
            return float(s)
        except Exception:
            return None

    if "," in s and "." not in s:
        s = s.replace(",", ".")
        try:
            return float(s)
        except Exception:
            return None

    try:
        return float(s)
    except Exception:
        pass

    s = re.sub(r"[^0-9\.\-]", "", s)
    try:
        return float(s)
    except Exception:
        return None


def _to_num(series: pd.Series) -> pd.Series:
    if series is None:
        return pd.Series(dtype="float64")
    return series.apply(_parse_number).astype("float64")


def month_start(d: date) -> date:
    return d.replace(day=1)


def month_end(d: date) -> date:
    if d.month == 12:
        return d.replace(day=31)
    return d.replace(month=d.month + 1, day=1) - timedelta(days=1)


def add_months(d: date, months: int) -> date:
    y = d.year + ((d.month - 1 + months) // 12)
    m = ((d.month - 1 + months) % 12) + 1
    day = min(d.day, month_end(date(y, m, 1)).day)
    return date(y, m, day)


def pt_month_name(d: date) -> str:
    meses = {
        1: "JANEIRO", 2: "FEVEREIRO", 3: "MARÇO", 4: "ABRIL",
        5: "MAIO", 6: "JUNHO", 7: "JULHO", 8: "AGOSTO",
        9: "SETEMBRO", 10: "OUTUBRO", 11: "NOVEMBRO", 12: "DEZEMBRO",
    }
    return meses[d.month]


def periodo_label(d_ini: date, d_fim: date) -> str:
    return f"{_fmt_br_date(d_ini)} a {_fmt_br_date(d_fim)}"


def cls_var(v):
    try:
        v = float(v)
    except Exception:
        v = 0
    if v > 0:
        return "#16a34a"
    if v < 0:
        return "#dc2626"
    return "#64748b"


def _ensure_vertex_adc_if_possible():
    if os.getenv("GOOGLE_APPLICATION_CREDENTIALS"):
        return
    if not VERTEX_SA_JSON:
        return
    try:
        tmp = Path("/tmp/vertex_sa.json")
        tmp.write_text(VERTEX_SA_JSON, encoding="utf-8")
        os.environ["GOOGLE_APPLICATION_CREDENTIALS"] = str(tmp)
    except Exception as e:
        print("⚠️ Falha ao montar ADC:", repr(e))


def definir_cluster_manutencao(veiculo):
    v = str(veiculo or "").strip().upper()
    if not v:
        return "OUTROS"
    if v.startswith("2216"):
        return "C8"
    if v.startswith("2222"):
        return "C9"
    if v.startswith("2224"):
        return "C10"
    if v.startswith("2425"):
        return "C11"
    if v.startswith("W"):
        return "C6"
    return "OUTROS"


# ==============================================================================
# REGRA DE OCORRÊNCIA
# ==============================================================================
TIPOS_GRAFICO = ["RECOLHEU", "SOS", "AVARIA", "TROCA", "IMPROCEDENTE"]

def normalize_tipo(oc):
    # pd.NA/float('nan') são "truthy" em Python, então `oc or ""` não pega esses casos
    # e a linha virava a string literal "NAN", contando como ocorrência válida por engano.
    if oc is None or (isinstance(oc, float) and pd.isna(oc)):
        return ""
    o = str(oc).upper().strip()
    if not o:
        return ""
    if o in ("RA", "R.A", "R.A."):
        return "RECOLHEU"
    if "RECOLH" in o:
        return "RECOLHEU"
    if "IMPRO" in o:
        return "IMPROCEDENTE"
    if "TROC" in o:
        return "TROCA"
    if o == "S.O.S":
        return "SOS"
    if "AVARI" in o:
        return "AVARIA"
    if "SEGUIU" in o:
        return "SEGUIU VIAGEM"
    return o


def is_ocorrencia_valida_para_mkbf(oc):
    tipo = normalize_tipo(oc)
    if not tipo:
        return False
    if tipo == "SEGUIU VIAGEM":
        return False
    return True


# ==============================================================================
# BUSCA DADOS
# ==============================================================================
def fetch_all_table_period(
    table_name: str, select_fields: str, date_field: str, start_date: date, end_date: date,
    sb_client=None,
) -> list[dict]:
    sb = sb_client or _sb_b()
    all_rows = []
    offset = 0

    while True:
        end = offset + REPORT_PAGE_SIZE - 1
        resp = (
            sb.table(table_name)
            .select(select_fields)
            .gte(date_field, str(start_date))
            .lte(date_field, str(end_date))
            .order(date_field, desc=False)
            .range(offset, end)
            .execute()
        )
        rows = resp.data or []
        all_rows.extend(rows)

        print(f"📦 [{table_name}] range={offset}-{end} fetched={len(rows)} total={len(all_rows)}")

        if len(rows) < REPORT_PAGE_SIZE:
            break
        if len(all_rows) >= REPORT_MAX_ROWS:
            all_rows = all_rows[:REPORT_MAX_ROWS]
            print(f"⚠️ [{table_name}] REPORT_MAX_ROWS atingido: {REPORT_MAX_ROWS}")
            break

        offset += REPORT_PAGE_SIZE
    return all_rows


def carregar_km_rodado(periodo_inicio: date, periodo_fim: date) -> pd.DataFrame:
    """KM rodado por dia, somado a partir de indicadores_diesel (km_transnet por veículo/dia)."""
    rows = fetch_all_table_period(
        table_name="indicadores_diesel",
        select_fields="data_consolidada, veiculo, km_transnet",
        date_field="data_consolidada",
        start_date=periodo_inicio, end_date=periodo_fim,
        sb_client=_sb_a(),
    )
    if not rows:
        return pd.DataFrame(columns=["data", "km_total"])
    df = pd.DataFrame(rows).rename(columns={"data_consolidada": "data", "km_transnet": "km_total"})
    return df


def carregar_km_por_cluster(periodo_inicio: date, periodo_fim: date) -> pd.DataFrame:
    """KM rodado por dia e por cluster, a partir de indicadores_diesel (km_transnet por veículo/dia)."""
    rows = fetch_all_table_period(
        table_name="indicadores_diesel",
        select_fields="data_consolidada, veiculo, km_transnet",
        date_field="data_consolidada",
        start_date=periodo_inicio, end_date=periodo_fim,
        sb_client=_sb_a(),
    )
    if not rows:
        return pd.DataFrame(columns=["data", "cluster", "km_total"])

    df = pd.DataFrame(rows).rename(columns={"data_consolidada": "data"})
    df["data"] = pd.to_datetime(df["data"], errors="coerce").dt.date
    df["km_total"] = _to_num(df["km_transnet"]).fillna(0)
    df["cluster"] = df["veiculo"].apply(definir_cluster_manutencao)

    return (df.dropna(subset=["data"]).groupby(["data", "cluster"], as_index=False)
            .agg(km_total=("km_total", "sum")).sort_values(["data", "cluster"]))


def carregar_sos(periodo_inicio: date, periodo_fim: date) -> pd.DataFrame:
    rows = fetch_all_table_period(
        table_name="sos_acionamentos", select_fields="id, numero_sos, data_sos, ocorrencia, status",
        date_field="data_sos", start_date=periodo_inicio, end_date=periodo_fim,
    )
    if not rows:
        return pd.DataFrame(columns=["id", "numero_sos", "data_sos", "ocorrencia", "status"])
    return pd.DataFrame(rows)


def carregar_sos_pagina_3(periodo_inicio: date, periodo_fim: date) -> pd.DataFrame:
    rows = fetch_all_table_period(
        table_name="sos_acionamentos",
        select_fields="id, numero_sos, data_sos, hora_sos, veiculo, linha, ocorrencia, status",
        date_field="data_sos",
        start_date=periodo_inicio,
        end_date=periodo_fim,
    )
    if not rows:
        return pd.DataFrame(
            columns=["id", "numero_sos", "data_sos", "hora_sos", "veiculo", "linha", "ocorrencia", "status"]
        )
    return pd.DataFrame(rows)


def carregar_sos_pagina_4(periodo_inicio: date, periodo_fim: date) -> pd.DataFrame:
    rows = fetch_all_table_period(
        table_name="sos_acionamentos",
        select_fields="id, data_sos, veiculo, linha, ocorrencia, status, problema_encontrado, setor_manutencao",
        date_field="data_sos",
        start_date=periodo_inicio,
        end_date=periodo_fim,
    )
    if not rows:
        return pd.DataFrame(
            columns=["id", "data_sos", "veiculo", "linha", "ocorrencia", "status", "problema_encontrado", "setor_manutencao"]
        )
    return pd.DataFrame(rows)


# ==============================================================================
# PROCESSAMENTO - PÁGINAS 1 E 2
# ==============================================================================
def processar_km_df(df_km: pd.DataFrame) -> pd.DataFrame:
    df = df_km.copy()
    if df.empty:
        return pd.DataFrame(columns=["data", "km_total"])
    df["data"] = pd.to_datetime(df["data"], errors="coerce").dt.date
    df["km_total"] = _to_num(df["km_total"]).fillna(0)
    df = (df.dropna(subset=["data"]).groupby("data", as_index=False)
          .agg(km_total=("km_total", "sum")).sort_values("data"))
    # Dias sem KM consolidado (ex: dia mais recente ainda não fechado no indicadores_diesel)
    # não entram no cálculo — evita diluir o MKBF com um denominador sem KM real.
    df = df[df["km_total"] > 0].reset_index(drop=True)
    return df


def processar_sos_df(df_sos: pd.DataFrame) -> pd.DataFrame:
    df = df_sos.copy()
    if df.empty:
        return pd.DataFrame(columns=["id", "numero_sos", "data_sos", "ocorrencia", "status", "tipo_norm", "valida_mkbf"])
    df["data_sos"] = pd.to_datetime(df["data_sos"], errors="coerce").dt.date
    df["tipo_norm"] = df["ocorrencia"].apply(normalize_tipo)
    df["valida_mkbf"] = df["ocorrencia"].apply(is_ocorrencia_valida_para_mkbf)
    return df.dropna(subset=["data_sos"]).copy()


def montar_diario_mkbf(df_km_proc: pd.DataFrame, df_sos_proc: pd.DataFrame) -> pd.DataFrame:
    km_dia = df_km_proc.copy()
    if df_sos_proc.empty:
        ocorr_dia = pd.DataFrame(columns=["data", "intervencoes"])
    else:
        ocorr_dia = (df_sos_proc[df_sos_proc["valida_mkbf"]].groupby("data_sos", as_index=False)
                     .size().rename(columns={"data_sos": "data", "size": "intervencoes"}))
    diario = km_dia.merge(ocorr_dia, on="data", how="left")
    diario["intervencoes"] = diario["intervencoes"].fillna(0).astype(int)
    diario["mkbf"] = diario.apply(
        lambda r: (r["km_total"] / r["intervencoes"]) if r["intervencoes"] > 0 else 0, axis=1,
    )
    return diario.sort_values("data").reset_index(drop=True)


def resumo_periodo(df_diario: pd.DataFrame, df_sos_proc: pd.DataFrame) -> dict:
    km_total = float(df_diario["km_total"].sum()) if not df_diario.empty else 0.0
    interv = int(df_diario["intervencoes"].sum()) if not df_diario.empty else 0
    mkbf = (km_total / interv) if interv > 0 else 0.0
    por_tipo = (df_sos_proc[df_sos_proc["tipo_norm"].isin(TIPOS_GRAFICO)]
                .groupby("tipo_norm", as_index=False).size()
                .rename(columns={"size": "total"}).sort_values("total", ascending=False))
    por_tipo_map = {r["tipo_norm"]: int(r["total"]) for _, r in por_tipo.iterrows()}
    for t in TIPOS_GRAFICO:
        por_tipo_map.setdefault(t, 0)
    return {
        "km_total": km_total, "intervencoes": interv, "mkbf": mkbf,
        "por_tipo_map": por_tipo_map, "por_tipo_df": por_tipo,
    }


def processar_pagina_1(periodo_inicio: date, periodo_fim: date) -> dict:
    df_km_atual = carregar_km_rodado(periodo_inicio, periodo_fim)
    df_sos_atual = carregar_sos(periodo_inicio, periodo_fim)

    km_atual = processar_km_df(df_km_atual)
    sos_atual = processar_sos_df(df_sos_atual)
    diario_atual = montar_diario_mkbf(km_atual, sos_atual)
    resumo_atual = resumo_periodo(diario_atual, sos_atual)

    ini_ant = month_start(add_months(periodo_inicio, -1))
    fim_ant = month_end(ini_ant)

    df_km_ant = carregar_km_rodado(ini_ant, fim_ant)
    df_sos_ant = carregar_sos(ini_ant, fim_ant)

    km_ant = processar_km_df(df_km_ant)
    sos_ant = processar_sos_df(df_sos_ant)
    diario_ant = montar_diario_mkbf(km_ant, sos_ant)
    resumo_ant = resumo_periodo(diario_ant, sos_ant)

    hist_rows = []
    mes_base = month_start(periodo_fim)
    meses_hist = [add_months(mes_base, -i) for i in range(11, -1, -1)]

    for mes_dt in meses_hist:
        ini_m = month_start(mes_dt)
        fim_m = month_end(mes_dt)
        df_km_m = processar_km_df(carregar_km_rodado(ini_m, fim_m))
        df_sos_m = processar_sos_df(carregar_sos(ini_m, fim_m))
        diario_m = montar_diario_mkbf(df_km_m, df_sos_m)
        resumo_m = resumo_periodo(diario_m, df_sos_m)
        hist_rows.append({
            "mes_dt": ini_m,
            "mes_label": f"{pt_month_name(ini_m)[:3]}/{str(ini_m.year)[2:]}",
            "mkbf": float(resumo_m["mkbf"]),
            "meta": float(MKBF_META),
            "km_total": float(resumo_m["km_total"]),
            "intervencoes": int(resumo_m["intervencoes"]),
        })

    df_hist = pd.DataFrame(hist_rows)

    tipos_all = sorted(set(TIPOS_GRAFICO) | set(resumo_atual["por_tipo_map"]) | set(resumo_ant["por_tipo_map"]))
    rows_motivos = []
    for t in tipos_all:
        rows_motivos.append({
            "tipo": t,
            "mes_anterior": int(resumo_ant["por_tipo_map"].get(t, 0)),
            "mes_atual": int(resumo_atual["por_tipo_map"].get(t, 0)),
        })

    df_motivos = pd.DataFrame(rows_motivos).sort_values(["mes_atual", "mes_anterior", "tipo"], ascending=[False, False, True])

    def pct_var(atual, anterior):
        if anterior in (0, None): return 0.0
        return ((atual - anterior) / anterior) * 100.0

    variacoes = {
        "intervencoes_pct": pct_var(resumo_atual["intervencoes"], resumo_ant["intervencoes"]),
        "km_pct": pct_var(resumo_atual["km_total"], resumo_ant["km_total"]),
        "mkbf_pct": pct_var(resumo_atual["mkbf"], resumo_ant["mkbf"]),
    }

    aderencia_meta_pct = (resumo_atual["mkbf"] / MKBF_META * 100.0) if MKBF_META > 0 else 0.0

    # Último dia com KM realmente consolidado no indicadores_diesel — o rótulo do
    # período exibe os dados reais, não o calendário (dias sem KM ficam fora do MKBF).
    periodo_fim_dados = diario_atual["data"].max() if not diario_atual.empty else periodo_fim

    return {
        "periodo_inicio": periodo_inicio, "periodo_fim": periodo_fim,
        "periodo_fim_dados": periodo_fim_dados,
        "periodo_label": periodo_label(periodo_inicio, periodo_fim_dados),
        "periodo_label_calendario": periodo_label(periodo_inicio, periodo_fim),
        "mes_atual_label": f"{pt_month_name(periodo_fim)}/{periodo_fim.year}",
        "mes_anterior_label": f"{pt_month_name(ini_ant)}/{ini_ant.year}",
        "resumo_atual": resumo_atual, "resumo_ant": resumo_ant,
        "df_diario_atual": diario_atual, "df_hist": df_hist,
        "df_motivos": df_motivos, "variacoes": variacoes,
        "aderencia_meta_pct": aderencia_meta_pct,
    }


def processar_pagina_2(periodo_inicio: date, periodo_fim: date, diario: pd.DataFrame, resumo_atual: dict) -> dict:
    df = diario.copy()
    if df.empty:
        df = pd.DataFrame(columns=["data", "km_total", "intervencoes", "mkbf"])
        df["dia"] = []
    else:
        df["dia"] = pd.to_datetime(df["data"]).dt.strftime("%d/%m")

    total_interv = int(resumo_atual.get("intervencoes", 0))
    total_km = float(resumo_atual.get("km_total", 0.0))
    mkbf_mes = float(resumo_atual.get("mkbf", 0.0))

    dias_periodo = (periodo_fim - periodo_inicio).days + 1
    dias_decorridos = len(df)
    media_interv_dia = (total_interv / dias_decorridos) if dias_decorridos > 0 else 0.0

    meta_interv_mes = (total_km / MKBF_META) if MKBF_META > 0 else 0.0
    meta_interv_dia = (meta_interv_mes / dias_periodo) if dias_periodo > 0 else 0.0
    delta_interv = total_interv - meta_interv_mes

    ultimo_dia_mes = month_end(periodo_fim)
    dias_mes = ultimo_dia_mes.day
    # Projeção usa dias_decorridos (dias com KM realmente consolidado), não o dia
    # do calendário — evita subestimar a projeção quando o(s) dia(s) mais recente(s)
    # ainda não têm KM fechado em indicadores_diesel.
    dia_atual_mes = dias_decorridos

    proj_km_mes = (total_km / dia_atual_mes) * dias_mes if dia_atual_mes > 0 else total_km
    proj_interv_mes = (total_interv / dia_atual_mes) * dias_mes if dia_atual_mes > 0 else total_interv

    # Rótulo do período segue o último dia com KM consolidado (igual à página 1)
    periodo_fim_dados = df["data"].max() if not df.empty else periodo_fim

    return {
        "periodo_inicio": periodo_inicio,
        "periodo_fim": periodo_fim,
        "periodo_label": periodo_label(periodo_inicio, periodo_fim_dados),
        "mes_atual_label": f"{pt_month_name(periodo_fim)}/{periodo_fim.year}",
        "diario": df,
        "total_interv": total_interv,
        "total_km": total_km,
        "mkbf_mes": mkbf_mes,
        "media_interv_dia": media_interv_dia,
        "meta_interv_mes": meta_interv_mes,
        "meta_interv_dia": meta_interv_dia,
        "delta_interv": delta_interv,
        "proj_km_mes": proj_km_mes,
        "proj_interv_mes": proj_interv_mes,
        "dias_periodo": dias_periodo,
        "dias_decorridos": dias_decorridos,
    }


# ==============================================================================
# PROCESSAMENTO - PÁGINA 3
# ==============================================================================
def processar_sos_pagina_3(df_sos: pd.DataFrame) -> pd.DataFrame:
    df = df_sos.copy()
    if df.empty:
        return pd.DataFrame(
            columns=[
                "id", "numero_sos", "data_sos", "hora_sos", "veiculo",
                "linha", "ocorrencia", "status", "tipo_norm",
                "valida_mkbf", "hora_int", "cluster",
            ]
        )

    df["data_sos"] = pd.to_datetime(df["data_sos"], errors="coerce").dt.date
    df["tipo_norm"] = df["ocorrencia"].apply(normalize_tipo)
    df["valida_mkbf"] = df["ocorrencia"].apply(is_ocorrencia_valida_para_mkbf)

    def extrair_hora(v):
        s = str(v or "").strip()
        if not s: return None
        try: return int(s[:2])
        except: return None

    df["hora_int"] = df["hora_sos"].apply(extrair_hora)
    df["linha"] = df["linha"].astype(str).str.strip().replace({"": "N/D"})
    df["veiculo"] = df["veiculo"].astype(str).str.strip().replace({"": "N/D"})
    df["cluster"] = df["veiculo"].apply(definir_cluster_manutencao)

    df = df.dropna(subset=["data_sos"]).copy()
    return df


def processar_pagina_3(periodo_fim: date) -> dict:
    periodo_fim = month_end(periodo_fim)
    periodo_inicio = month_start(add_months(periodo_fim, -2))

    df_sos = carregar_sos_pagina_3(periodo_inicio, periodo_fim)
    sos_proc = processar_sos_pagina_3(df_sos)
    base = sos_proc[sos_proc["valida_mkbf"]].copy()

    meses_lista = [month_start(add_months(periodo_fim, -i)) for i in range(2, -1, -1)]
    meses_labels = [f"{pt_month_name(m)[:3]}/{str(m.year)[2:]}" for m in meses_lista]
    mes_ref_label = meses_labels[-1]

    if base.empty:
        vazio_linha = pd.DataFrame(columns=["linha", "int_total", "int_ref"])
        vazio_hora = pd.DataFrame(columns=["hora_int", "int_total", "int_ref"])
        vazio_carro = pd.DataFrame(columns=["veiculo", "int_total", "int_ref"])
        vazio_cluster = pd.DataFrame(columns=["cluster", "frota_ref", "int_veiculo_ref"])
        for m in meses_labels: vazio_cluster[m] = 0

        return {
            "periodo_inicio": periodo_inicio, "periodo_fim": periodo_fim,
            "periodo_label": periodo_label(periodo_inicio, periodo_fim),
            "mes_ref_label": mes_ref_label,
            "meses_labels": meses_labels,
            "total_interv": 0,
            "total_interv_ref": 0,
            "df_linha": vazio_linha,
            "df_horario": vazio_hora,
            "df_top_carro": vazio_carro,
            "df_cluster": vazio_cluster,
        }

    base['is_ref'] = base['data_sos'].apply(lambda d: d.year == periodo_fim.year and d.month == periodo_fim.month)
    base['mes_label'] = base['data_sos'].apply(lambda d: f"{pt_month_name(d)[:3]}/{str(d.year)[2:]}")

    df_linha = base.groupby("linha").agg(
        int_total=('id', 'count'),
        int_ref=('is_ref', 'sum')
    ).reset_index().sort_values(["int_ref", "int_total"], ascending=[False, False]).head(14)

    df_horario = base.dropna(subset=["hora_int"]).groupby("hora_int").agg(
        int_total=('id', 'count'),
        int_ref=('is_ref', 'sum')
    ).reset_index().sort_values(["hora_int"], ascending=[True])

    df_top_carro = base.groupby("veiculo").agg(
        int_total=('id', 'count'),
        int_ref=('is_ref', 'sum')
    ).reset_index().sort_values(["int_ref", "int_total"], ascending=[False, False]).head(10)

    pivot = base.pivot_table(index="cluster", columns="mes_label", values="id", aggfunc="count", fill_value=0)
    for m_lbl in meses_labels:
        if m_lbl not in pivot.columns:
            pivot[m_lbl] = 0
    pivot = pivot.reset_index()

    frota_ref = base[base['is_ref']].groupby('cluster')['veiculo'].nunique().reset_index().rename(columns={'veiculo': 'frota_ref'})
    df_cluster = pd.merge(pivot, frota_ref, on='cluster', how='left').fillna(0)
    df_cluster['frota_ref'] = df_cluster['frota_ref'].astype(int)

    df_cluster['int_veiculo_ref'] = df_cluster.apply(
        lambda r: (r[mes_ref_label] / r['frota_ref']) if r['frota_ref'] > 0 else 0.0, axis=1
    )

    # MKBF por cluster no mês de referência (KM do indicadores_diesel ÷ intervenções válidas do cluster)
    mes_ref_ini = month_start(periodo_fim)
    mes_ref_fim = periodo_fim
    df_km_cluster_ref = carregar_km_por_cluster(mes_ref_ini, mes_ref_fim)
    km_ref = (df_km_cluster_ref.groupby("cluster", as_index=False)["km_total"].sum()
              .rename(columns={"km_total": "km_ref"})) if not df_km_cluster_ref.empty else pd.DataFrame(columns=["cluster", "km_ref"])
    df_cluster = pd.merge(df_cluster, km_ref, on="cluster", how="left")
    df_cluster["km_ref"] = df_cluster["km_ref"].fillna(0.0)
    df_cluster["mkbf_cluster"] = df_cluster.apply(
        lambda r: (r["km_ref"] / r[mes_ref_label]) if r[mes_ref_label] > 0 else 0.0, axis=1
    )

    df_cluster = df_cluster.sort_values(by=mes_ref_label, ascending=False).reset_index(drop=True)

    return {
        "periodo_inicio": periodo_inicio,
        "periodo_fim": periodo_fim,
        "periodo_label": periodo_label(periodo_inicio, periodo_fim),
        "mes_ref_label": mes_ref_label,
        "meses_labels": meses_labels,
        "total_interv": len(base),
        "total_interv_ref": int(base['is_ref'].sum()),
        "df_linha": df_linha,
        "df_horario": df_horario,
        "df_top_carro": df_top_carro,
        "df_cluster": df_cluster,
    }


CLUSTERS_ATIVOS = ["C6", "C8", "C9", "C10", "C11"]


def processar_evolucao_mkbf_cluster(periodo_fim: date, meses: int = 6) -> pd.DataFrame:
    """MKBF por cluster mês a mês (KM de indicadores_diesel ÷ intervenções válidas de sos_acionamentos)."""
    periodo_fim = month_end(periodo_fim)
    meses_lista = [month_start(add_months(periodo_fim, -i)) for i in range(meses - 1, -1, -1)]

    rows = []
    for mes_dt in meses_lista:
        ini_m = month_start(mes_dt)
        fim_m = min(month_end(mes_dt), periodo_fim)
        mes_label = f"{pt_month_name(mes_dt)[:3]}/{str(mes_dt.year)[2:]}"

        df_km_cluster = carregar_km_por_cluster(ini_m, fim_m)
        km_por_cluster = (df_km_cluster.groupby("cluster")["km_total"].sum()
                           if not df_km_cluster.empty else pd.Series(dtype=float))

        df_sos = carregar_sos_pagina_3(ini_m, fim_m)  # inclui "veiculo", necessário pra montar o cluster
        sos_proc = processar_sos_pagina_3(df_sos)
        base_valida = sos_proc[sos_proc["valida_mkbf"]] if not sos_proc.empty else sos_proc
        interv_por_cluster = base_valida.groupby("cluster").size() if not base_valida.empty else pd.Series(dtype=int)

        for c in CLUSTERS_ATIVOS:
            km = float(km_por_cluster.get(c, 0.0))
            interv = int(interv_por_cluster.get(c, 0))
            mkbf = (km / interv) if interv > 0 else None  # None = sem dado no mês (não plotar ponto)
            rows.append({"mes_label": mes_label, "mes_dt": mes_dt, "cluster": c, "km": km, "intervencoes": interv, "mkbf": mkbf})

    return pd.DataFrame(rows)


# ==============================================================================
# PROCESSAMENTO - PLANOS DE PREVENTIVA (ultimo_plano / Supabase A)
# ==============================================================================
def _fetch_ultimo_plano() -> pd.DataFrame:
    """Snapshot do último plano ativo por veículo/plano (tabela ultimo_plano no Supabase A)."""
    sb = _sb_a()
    all_rows, offset = [], 0
    while True:
        resp = (sb.table("ultimo_plano")
                .select("nr_ordem, ds_plano, qt_km_intervalo, qt_dia_intervalo, "
                        "km_para_proxima, dias_vencido, cs_ativo")
                .range(offset, offset + REPORT_PAGE_SIZE - 1)
                .execute())
        rows = resp.data or []
        all_rows.extend(rows)
        if len(rows) < REPORT_PAGE_SIZE:
            break
        offset += REPORT_PAGE_SIZE
    if not all_rows:
        return pd.DataFrame(columns=["nr_ordem", "ds_plano", "qt_km_intervalo",
                                     "qt_dia_intervalo", "km_para_proxima", "dias_vencido"])
    return pd.DataFrame(all_rows)


def _plano_vencido(row) -> bool:
    """Regra de vencimento por natureza do plano.

    - Plano por KM  (qt_km_intervalo > 0): vencido quando km_para_proxima >= 0
      (já rodou o intervalo inteiro; negativo = ainda faltam |x| km).
    - Plano por TEMPO (ex: Aferição Tacógrafo/TCO, qt_km_intervalo = 0 e
      qt_dia_intervalo > 0): vencido quando dias_vencido > 0.
      NÃO usar km_para_proxima aqui — a importação grava o km_rodado nesse campo
      para planos de tempo, o que fingiria vencimento por dezenas de milhares de km.
    """
    km_int = row.get("qt_km_intervalo") or 0
    dia_int = row.get("qt_dia_intervalo") or 0
    if km_int > 0:
        kmp = row.get("km_para_proxima")
        return kmp is not None and kmp >= 0
    if dia_int > 0:
        dv = row.get("dias_vencido")
        return dv is not None and dv > 0
    return False


def processar_planos_vencidos() -> dict:
    df = _fetch_ultimo_plano()
    vazio = {
        "total_planos": 0, "em_dia": 0, "total_vencidos": 0, "acuracidade_pct": 0.0,
        "df_vencidos": df, "por_plano": pd.DataFrame(columns=["ds_plano", "qtd"]),
        "df_concessionaria": pd.DataFrame(),
    }
    if df.empty:
        return vazio

    for c in ["qt_km_intervalo", "qt_dia_intervalo", "km_para_proxima", "dias_vencido"]:
        df[c] = _to_num(df.get(c))

    if "cs_ativo" in df.columns:
        df = df[df["cs_ativo"].astype(str).str.upper() != "N"].copy()

    df["vencido"] = df.apply(_plano_vencido, axis=1)
    df["por_km"] = df["qt_km_intervalo"] > 0
    df["km_vencido"] = df.apply(
        lambda r: r["km_para_proxima"] if (r["por_km"] and r["vencido"]) else None, axis=1
    )

    # Concessionária EURO6 (garantia/dealership) sai da conta de preventivas in-house:
    # é acompanhada em slide próprio e nem sempre aparece no export do sistema.
    is_conc = df["ds_plano"].astype(str).str.contains("CONCESS", case=False, na=False)
    concessionaria = df[is_conc].copy()
    inhouse = df[~is_conc].copy()

    total = int(len(inhouse))
    venc = inhouse[inhouse["vencido"]].copy().sort_values("km_vencido", ascending=False, na_position="last")
    n_venc = int(len(venc))
    em_dia = total - n_venc
    # Acuracidade = planos em dia / (em dia + vencidos) = em dia / total ativo
    acuracidade = (em_dia / total * 100.0) if total > 0 else 0.0

    por_plano = (venc.groupby("ds_plano", as_index=False).size()
                 .rename(columns={"size": "qtd"}).sort_values("qtd", ascending=False))

    return {
        "total_planos": total,
        "em_dia": em_dia,
        "total_vencidos": n_venc,
        "acuracidade_pct": acuracidade,
        "vencidos_por_km": int(venc["por_km"].sum()),
        "vencidos_por_tempo": int((~venc["por_km"]).sum()),
        "df_vencidos": venc,
        "por_plano": por_plano,
        "df_concessionaria": concessionaria,
    }


def registrar_snapshot_acuracidade(dados_venc: dict, data_ref: date | None = None) -> None:
    """Grava (upsert) o snapshot diário de acuracidade em preventivas_acuracidade_hist.

    Chamado a cada execução do workflow. Como a ultimo_plano não tem histórico,
    esta linha por dia permite fechar a acuracidade por mês (último dia do mês).
    """
    if data_ref is None:
        data_ref = _parse_iso(REPORT_PERIODO_FIM) or date.today()
    if dados_venc.get("total_planos", 0) <= 0:
        print("⚠️ Snapshot de acuracidade não gravado: total_planos=0")
        return
    payload = {
        "data_ref": str(data_ref),
        "total_planos": int(dados_venc["total_planos"]),
        "em_dia": int(dados_venc["em_dia"]),
        "vencidos": int(dados_venc["total_vencidos"]),
        "vencidos_km": int(dados_venc.get("vencidos_por_km", 0)),
        "vencidos_tempo": int(dados_venc.get("vencidos_por_tempo", 0)),
        "acuracidade_pct": round(float(dados_venc["acuracidade_pct"]), 2),
    }
    try:
        _sb_a().table("preventivas_acuracidade_hist").upsert(
            payload, on_conflict="data_ref"
        ).execute()
        print(f"✅ Snapshot acuracidade {data_ref}: {payload['acuracidade_pct']}% "
              f"({payload['em_dia']}/{payload['total_planos']})")
    except Exception as e:
        print("⚠️ Falha ao gravar snapshot de acuracidade:", repr(e))


def carregar_acuracidade_mensal(meses: int = 6, ate: date | None = None) -> pd.DataFrame:
    """Fechamento mensal da acuracidade (último snapshot de cada mês)."""
    if ate is None:
        ate = _parse_iso(REPORT_PERIODO_FIM) or date.today()
    ini = month_start(add_months(ate, -(meses - 1)))
    rows = fetch_all_table_period(
        table_name="preventivas_acuracidade_hist",
        select_fields="data_ref, total_planos, em_dia, vencidos, acuracidade_pct",
        date_field="data_ref", start_date=ini, end_date=ate, sb_client=_sb_a(),
    )
    if not rows:
        return pd.DataFrame(columns=["mes", "data_fechamento", "acuracidade_pct", "vencidos", "total_planos"])
    df = pd.DataFrame(rows)
    df["data_ref"] = pd.to_datetime(df["data_ref"], errors="coerce")
    df["mes"] = df["data_ref"].dt.to_period("M")
    # último snapshot de cada mês = fechamento
    fech = (df.sort_values("data_ref").groupby("mes", as_index=False).tail(1)
            .sort_values("data_ref").reset_index(drop=True))
    fech["mes_label"] = fech["data_ref"].dt.strftime("%b/%y").str.upper()
    return fech


# ==============================================================================
# PROCESSAMENTO - GNS / CARROS PARADOS (veiculos_pcm / pcm_diario)
# ==============================================================================
# Indicador GNS = média de carros na categoria GNS nos DIAS ÚTEIS do mês
# (exclui sábado, domingo e feriados). Cada carro conta 1x por dia (dedup).
# Feriados via env REPORT_FERIADOS (datas YYYY-MM-DD separadas por vírgula).
def _feriados() -> set:
    raw = os.getenv("REPORT_FERIADOS", "")
    out = set()
    for d in raw.split(","):
        d = d.strip()
        if d:
            try:
                out.add(_parse_iso(d))
            except Exception:
                pass
    return out


def processar_gns(periodo_inicio: date, periodo_fim: date) -> dict:
    """Indicador GNS mensal = média de carros GNS por dia ÚTIL do mês
    (exclui fim de semana e feriados), a partir das sessões diárias de PCM.
    Também retorna o detalhe dos carros parados na sessão do último dia.
    """
    sb = _sb_b()
    feriados = _feriados()
    sessoes = (sb.table("pcm_diario").select("id, data_referencia")
               .gte("data_referencia", str(periodo_inicio))
               .lte("data_referencia", str(periodo_fim))
               .order("data_referencia", desc=False).execute().data or [])
    if not sessoes:
        return {"gns_medio": 0.0, "dias_uteis": 0, "df_diario": pd.DataFrame(),
                "df_parados": pd.DataFrame(), "total_parado": 0, "por_setor": {}}

    linhas = []
    ultima_sessao = None
    for s in sessoes:
        dt = _parse_iso(s["data_referencia"])
        util = (dt.weekday() < 5) and (dt not in feriados)  # seg-sex, exceto feriado
        # "Em aberto" na sessão = ainda não liberado (data_saida NULL) e que já havia
        # entrado até a data de referência. Carros liberados no dia (data_saida
        # preenchida) ou lançados para o dia seguinte não entram na contagem.
        vs = (sb.table("veiculos_pcm")
              .select("frota, categoria, setor, descricao, data_entrada, data_saida, previsao")
              .eq("pcm_id", s["id"]).is_("data_saida", "null").execute().data or [])
        dfv = pd.DataFrame(vs)
        if not dfv.empty:
            ent = pd.to_datetime(dfv["data_entrada"], errors="coerce").dt.tz_localize(None).dt.date
            dfv = dfv[ent <= dt].drop_duplicates("frota")  # entrou até a data e 1x por carro
        gns = int((dfv["categoria"] == "GNS").sum()) if not dfv.empty else 0
        fa = int((dfv["categoria"] == "FAIXA_AMARELA").sum()) if not dfv.empty else 0
        linhas.append({"data": s["data_referencia"], "util": util,
                       "gns": gns, "faixa_amarela": fa})
        ultima_sessao = (s, dfv)

    df_diario = pd.DataFrame(linhas)
    uteis = df_diario[df_diario["util"]]

    df_parados = pd.DataFrame()
    total_parado = 0
    por_setor = {}
    if ultima_sessao and not ultima_sessao[1].empty:
        dfp = ultima_sessao[1].copy()
        dfp["dias_parado"] = (pd.Timestamp(periodo_fim) -
                              pd.to_datetime(dfp["data_entrada"], errors="coerce").dt.tz_localize(None)).dt.days
        df_parados = dfp.sort_values("dias_parado", ascending=False).reset_index(drop=True)
        total_parado = int(len(dfp))
        por_setor = dfp["setor"].value_counts().to_dict()

    return {
        "gns_medio": float(uteis["gns"].mean()) if not uteis.empty else 0.0,
        "dias_uteis": int(len(uteis)),
        "df_diario": df_diario,
        "df_parados": df_parados,
        "total_parado": total_parado,
        "por_setor": por_setor,
    }


# ==============================================================================
# PROCESSAMENTO - REGENERAÇÃO DO DPF (eventos_regeneracao / Supabase A)
# ==============================================================================
def processar_regeneracao(periodo_inicio: date, periodo_fim: date, meses_hist: int = 8) -> dict:
    """Eventos de regeneração do DPF: custo de diesel, top veículos e evolução mensal."""
    rows = fetch_all_table_period(
        table_name="eventos_regeneracao",
        select_fields="prefixo, motorista, dt_inicio, duracao_min, rpm_medio, consumo_litros, custo_reais",
        date_field="dt_inicio", start_date=periodo_inicio, end_date=periodo_fim, sb_client=_sb_a(),
    )
    df = pd.DataFrame(rows)
    resumo = {"eventos": 0, "custo_total": 0.0, "consumo_total": 0.0, "duracao_media": 0.0,
              "veiculos": 0, "top_veiculos": pd.DataFrame(), "evolucao_mensal": pd.DataFrame()}
    if not df.empty:
        for c in ["duracao_min", "rpm_medio", "consumo_litros", "custo_reais"]:
            df[c] = _to_num(df.get(c))
        resumo.update({
            "eventos": int(len(df)),
            "custo_total": float(df["custo_reais"].sum()),
            "consumo_total": float(df["consumo_litros"].sum()),
            "duracao_media": float(df["duracao_min"].mean()),
            "veiculos": int(df["prefixo"].nunique()),
            "top_veiculos": (df.groupby("prefixo", as_index=False)
                             .agg(eventos=("dt_inicio", "count"), custo=("custo_reais", "sum"),
                                  dur_media=("duracao_min", "mean"))
                             .sort_values("eventos", ascending=False).head(10)),
        })

    # evolução mensal (custo e eventos) nos últimos N meses
    ini_hist = month_start(add_months(periodo_fim, -(meses_hist - 1)))
    dfh = pd.DataFrame(fetch_all_table_period(
        table_name="eventos_regeneracao", select_fields="dt_inicio, custo_reais",
        date_field="dt_inicio", start_date=ini_hist, end_date=periodo_fim, sb_client=_sb_a(),
    ))
    if not dfh.empty:
        dfh["custo_reais"] = _to_num(dfh["custo_reais"])
        dfh["mes"] = pd.to_datetime(dfh["dt_inicio"], errors="coerce").dt.to_period("M")
        resumo["evolucao_mensal"] = (dfh.groupby("mes", as_index=False)
                                     .agg(eventos=("dt_inicio", "count"), custo=("custo_reais", "sum")))

    # --- Impacto da regeneração no KM/L da empresa no período ---
    # O diesel queimado na regeneração entra no consumo total mas nao gera KM util,
    # entao puxa o KM/L da frota para baixo. Mede-se recalculando o indicador sem
    # esses litros: kml_sem_regen = km / (litros - litros_regen).
    # Fonte do KM/L: indicadores_diesel (km_transnet / combustivel_transnet), a mesma
    # base ja usada no MKBF — assim o numero conversa com o resto do relatorio.
    ind = pd.DataFrame(fetch_all_table_period(
        table_name="indicadores_diesel",
        select_fields="data_consolidada, km_transnet, combustivel_transnet",
        date_field="data_consolidada", start_date=periodo_inicio, end_date=periodo_fim,
        sb_client=_sb_a(),
    ))
    km_periodo = litros_periodo = 0.0
    if not ind.empty:
        km_periodo = float(_to_num(ind["km_transnet"]).sum())
        litros_periodo = float(_to_num(ind["combustivel_transnet"]).sum())
    litros_regen = float(resumo["consumo_total"])
    kml_com = (km_periodo / litros_periodo) if litros_periodo else 0.0
    litros_sem = litros_periodo - litros_regen
    kml_sem = (km_periodo / litros_sem) if litros_sem > 0 else 0.0
    resumo.update({
        "kml_com_regen": kml_com,
        "kml_sem_regen": kml_sem,
        "kml_impacto": (kml_sem - kml_com),                       # quanto o KM/L sobe sem a regen
        "kml_impacto_pct": ((kml_sem - kml_com) / kml_sem * 100.0) if kml_sem else 0.0,
        "litros_periodo": litros_periodo,
        "litros_regen_pct": (litros_regen / litros_periodo * 100.0) if litros_periodo else 0.0,
    })
    return resumo


# ==============================================================================
# PROCESSAMENTO - EMBARCADOS (câmeras / vision críticos)
# ==============================================================================
def processar_embarcados() -> dict:
    """Solicitações de reparo de embarcados abertas, com foco nos críticos."""
    sb = _sb_b()
    rows = (sb.table("embarcados_solicitacoes_reparo")
            .select("veiculo, tipo_embarcado, problema, local_problema, prioridade, status, created_at")
            .execute().data or [])
    df = pd.DataFrame(rows)
    if df.empty:
        return {"total": 0, "abertos": 0, "criticos": 0, "df_criticos": df}

    abertos = df[df["status"].astype(str).str.upper().isin(["ABERTA", "ABERTO"])].copy()
    crit = abertos[abertos["prioridade"].astype(str).str.upper().isin(["CRITICA", "CRÍTICA"])].copy()
    if not crit.empty:
        crit["dt"] = pd.to_datetime(crit["created_at"], errors="coerce")
        crit = crit.sort_values("dt").reset_index(drop=True)

    concluidas = df[df["status"].astype(str).str.upper().isin(["CONCLUIDA", "CONCLUÍDA", "FINALIZADA"])].copy()

    df["dt_created"] = pd.to_datetime(df["created_at"], errors="coerce")
    df_mes = df.dropna(subset=["dt_created"]).copy()
    por_mes = pd.DataFrame(columns=["mes", "qtd"])
    if not df_mes.empty:
        df_mes["mes"] = df_mes["dt_created"].dt.to_period("M")
        por_mes = (df_mes.groupby("mes", as_index=False).size()
                   .rename(columns={"size": "qtd"}).sort_values("mes"))

    por_tipo = abertos[abertos["prioridade"].astype(str).str.upper().isin(["CRITICA", "CRÍTICA"])]["tipo_embarcado"].value_counts().to_dict() \
        if not abertos.empty else {}

    return {
        "total": int(len(df)),
        "abertos": int(len(abertos)),
        "criticos": int(len(crit)),
        "concluidas": int(len(concluidas)),
        "por_status": df["status"].value_counts().to_dict(),
        "por_tipo_total": df["tipo_embarcado"].value_counts().to_dict() if "tipo_embarcado" in df.columns else {},
        "por_mes": por_mes,
        "df_criticos": crit,
    }


# ==============================================================================
# PROCESSAMENTO - MOTORISTAS (procedentes / improcedentes)
# ==============================================================================
def processar_motoristas(periodo_inicio: date, periodo_fim: date) -> dict:
    """Top motoristas por intervenções procedentes (mês) e improcedentes (ano)."""
    # Mês de referência: procedentes (intervenções válidas)
    df_mes = pd.DataFrame(fetch_all_table_period(
        table_name="sos_acionamentos", select_fields="motorista_nome, ocorrencia, data_sos",
        date_field="data_sos", start_date=periodo_inicio, end_date=periodo_fim,
    ))
    top_proc = pd.DataFrame(columns=["motorista_nome", "qtd"])
    if not df_mes.empty:
        df_mes["tipo"] = df_mes["ocorrencia"].apply(normalize_tipo)
        val = df_mes[df_mes["ocorrencia"].apply(is_ocorrencia_valida_para_mkbf) &
                     (df_mes["tipo"] != "IMPROCEDENTE")]
        top_proc = (val.groupby("motorista_nome", as_index=False).size()
                    .rename(columns={"size": "qtd"}).sort_values("qtd", ascending=False).head(5))

    # Ano corrente: improcedentes por mês e por motorista
    ini_ano = date(periodo_fim.year, 1, 1)
    df_ano = pd.DataFrame(fetch_all_table_period(
        table_name="sos_acionamentos", select_fields="motorista_nome, ocorrencia, data_sos",
        date_field="data_sos", start_date=ini_ano, end_date=periodo_fim,
    ))
    impro_mes = pd.DataFrame(columns=["mes", "qtd"])
    top_impro = pd.DataFrame(columns=["motorista_nome", "qtd"])
    if not df_ano.empty:
        df_ano["tipo"] = df_ano["ocorrencia"].apply(normalize_tipo)
        impro = df_ano[df_ano["tipo"] == "IMPROCEDENTE"].copy()
        if not impro.empty:
            impro["mes"] = pd.to_datetime(impro["data_sos"], errors="coerce").dt.month
            impro_mes = (impro.groupby("mes", as_index=False).size()
                         .rename(columns={"size": "qtd"}).sort_values("mes"))
            top_impro = (impro.groupby("motorista_nome", as_index=False).size()
                         .rename(columns={"size": "qtd"}).sort_values("qtd", ascending=False).head(5))

    return {
        "top_procedentes": top_proc,
        "improcedentes_por_mes": impro_mes,
        "top_improcedentes": top_impro,
        "total_improcedentes_ano": int(impro_mes["qtd"].sum()) if not impro_mes.empty else 0,
    }


# ==============================================================================
# PROCESSAMENTO - PÁGINA 4 (NOVA)
# ==============================================================================
def processar_pagina_4(periodo_fim: date) -> dict:
    periodo_fim = month_end(periodo_fim)
    periodo_inicio = month_start(add_months(periodo_fim, -2))

    df_sos = carregar_sos_pagina_4(periodo_inicio, periodo_fim)
    
    if df_sos.empty:
        df_sos = pd.DataFrame(columns=["id", "data_sos", "veiculo", "linha", "ocorrencia", "status", "problema_encontrado", "setor_manutencao"])
    
    df_sos["data_sos"] = pd.to_datetime(df_sos["data_sos"], errors="coerce").dt.date
    df_sos["tipo_norm"] = df_sos["ocorrencia"].apply(normalize_tipo)
    df_sos["valida_mkbf"] = df_sos["ocorrencia"].apply(is_ocorrencia_valida_para_mkbf)
    
    base = df_sos[df_sos["valida_mkbf"]].copy()
    
    meses_lista = [month_start(add_months(periodo_fim, -i)) for i in range(2, -1, -1)]
    meses_labels = [f"{pt_month_name(m)[:3]}/{str(m.year)[2:]}" for m in meses_lista]
    
    if base.empty:
        return {
            "periodo_inicio": periodo_inicio, "periodo_fim": periodo_fim,
            "periodo_label": periodo_label(periodo_inicio, periodo_fim),
            "meses_labels": meses_labels,
            "total_interv": 0,
            "top_defeito": "N/D", "top_setor": "N/D", "top_veiculo": "N/D",
            "top_5_linhas": [], "top_5_carros": []
        }

    base["problema_encontrado"] = base["problema_encontrado"].astype(str).str.strip().replace({"": "N/D", "None": "N/D", "nan": "N/D"})
    base["setor_manutencao"] = base["setor_manutencao"].astype(str).str.strip().replace({"": "N/D", "None": "N/D", "nan": "N/D"})
    base["linha"] = base["linha"].astype(str).str.strip().replace({"": "N/D", "None": "N/D", "nan": "N/D"})
    base["veiculo"] = base["veiculo"].astype(str).str.strip().replace({"": "N/D", "None": "N/D", "nan": "N/D"})
    base['mes_label'] = base['data_sos'].apply(lambda d: f"{pt_month_name(d)[:3]}/{str(d.year)[2:]}")

    total_interv = len(base)
    top_defeito = base["problema_encontrado"].value_counts().index[0] if not base["problema_encontrado"].empty else "N/D"
    top_setor = base["setor_manutencao"].value_counts().index[0] if not base["setor_manutencao"].empty else "N/D"
    top_veiculo = base["veiculo"].value_counts().index[0] if not base["veiculo"].empty else "N/D"

    # Top 5 Linhas + Maior Defeito
    top_5_linhas_counts = base["linha"].value_counts().head(5)
    top_5_linhas = []
    for linha, count in top_5_linhas_counts.items():
        df_l = base[base["linha"] == linha]
        maior_defeito = df_l["problema_encontrado"].value_counts().index[0] if not df_l.empty else "N/D"
        top_5_linhas.append({"linha": linha, "total": count, "maior_defeito": maior_defeito})

    # Top 5 Carros detalhado
    top_5_carros_counts = base["veiculo"].value_counts().head(5)
    top_5_carros = []
    for carro, count in top_5_carros_counts.items():
        df_c = base[base["veiculo"] == carro]
        
        dist_mes = df_c["mes_label"].value_counts().to_dict()
        m1 = dist_mes.get(meses_labels[0], 0)
        m2 = dist_mes.get(meses_labels[1], 0)
        m3 = dist_mes.get(meses_labels[2], 0)

        def_counts = df_c["problema_encontrado"].value_counts().head(3)
        top_defeitos_str = " | ".join([f"{k} ({v})" for k, v in def_counts.items()])
        
        setor_prin = df_c["setor_manutencao"].value_counts().index[0] if not df_c.empty else "N/D"
        linha_prin = df_c["linha"].value_counts().index[0] if not df_c.empty else "N/D"

        top_5_carros.append({
            "veiculo": carro, 
            "total": count,
            "m1": m1, "m2": m2, "m3": m3,
            "top_defeitos": top_defeitos_str,
            "setor_principal": setor_prin,
            "linha_principal": linha_prin
        })

    return {
        "periodo_inicio": periodo_inicio, "periodo_fim": periodo_fim,
        "periodo_label": periodo_label(periodo_inicio, periodo_fim),
        "meses_labels": meses_labels,
        "total_interv": total_interv,
        "top_defeito": top_defeito,
        "top_setor": top_setor,
        "top_veiculo": top_veiculo,
        "top_5_linhas": top_5_linhas,
        "top_5_carros": top_5_carros
    }


# ==============================================================================
# PROCESSAMENTO - BORRACHARIA (pneus / TransNet · Supabase B)
# ==============================================================================
def _fetch_all_rows(sb, table: str, select_fields: str = "*") -> pd.DataFrame:
    """Lê uma tabela inteira (sem filtro de data) paginando de forma segura."""
    out = []
    offset = 0
    while True:
        end = offset + REPORT_PAGE_SIZE - 1
        rows = sb.table(table).select(select_fields).range(offset, end).execute().data or []
        out.extend(rows)
        if len(rows) < REPORT_PAGE_SIZE:
            break
        if len(out) >= REPORT_MAX_ROWS:
            out = out[:REPORT_MAX_ROWS]
            break
        offset += REPORT_PAGE_SIZE
    return pd.DataFrame(out)


def processar_borracharia(periodo_fim: date) -> dict:
    """Pneus: trocas do mês, estoque no TransNet, acuracidade do controle e
    teste de KM dos pneus novos (coorte por mês de cadastro do nº de fogo).

    Fontes (Supabase B): pcm_troca_pneus, pcm_pneus_transnet_ativos,
    vw_pcm_controle_pneus_central. NUNCA usar pcm_estoque_pneus (histórico infla).
    O 'estoque físico' é contagem manual da borracharia — informar via env
    REPORT_BORRACHARIA_FISICO; sem isso usamos o estoque do TransNet.
    """
    sb = _sb_b()
    mes_ref = periodo_fim.strftime("%Y-%m")
    trimestre_ini = month_start(add_months(periodo_fim, -2))

    # --- Trocas ---
    tr = _fetch_all_rows(sb, "pcm_troca_pneus", "created_at, tipo_troca, prefixo_instalacao")
    trocas_mes = 0
    trocas_trimestre = 0
    trocas_por_mes = {}
    tipo_troca = {}
    if not tr.empty:
        tr["dt"] = pd.to_datetime(tr["created_at"], errors="coerce", utc=True).dt.tz_localize(None)
        tr["mes"] = tr["dt"].dt.strftime("%Y-%m")
        trocas_por_mes = tr["mes"].value_counts().to_dict()
        trocas_mes = int((tr["mes"] == mes_ref).sum())
        trocas_trimestre = int((tr["dt"] >= pd.Timestamp(trimestre_ini)).sum())
        tipo_troca = tr[tr["mes"] == mes_ref]["tipo_troca"].value_counts().to_dict()

    # --- Estoque no TransNet (pneus ativos parados na borracharia) ---
    pn = _fetch_all_rows(sb, "pcm_pneus_transnet_ativos",
                         "numero_fogo, vida_atual, localizacao, km_rodada")
    estoque_transnet = 0
    estoque_vida = {}
    if not pn.empty:
        pn["loc"] = pn["localizacao"].astype(str).str.upper()
        borr = pn[pn["loc"].str.contains("BORRACHARIA")].drop_duplicates("numero_fogo")
        estoque_transnet = int(len(borr))
        estoque_vida = borr["vida_atual"].value_counts().to_dict()
    novos_estoque = int(estoque_vida.get("NOVO", 0))
    recap_estoque = estoque_transnet - novos_estoque

    fisico_env = os.getenv("REPORT_BORRACHARIA_FISICO")
    estoque_fisico = int(fisico_env) if (fisico_env or "").isdigit() else None

    # --- Acuracidade do controle central (auditoria de pneus nos carros) ---
    vw = _fetch_all_rows(sb, "vw_pcm_controle_pneus_central",
                         "status, numero_fogo_base, prefixo_base, posicao")
    corretos_ok = corretos_total = 0
    df_divergentes = pd.DataFrame()
    if not vw.empty:
        corretos_total = int(len(vw))
        st = vw["status"].astype(str).str.upper()
        corretos_ok = int((st == "OK").sum())
        df_divergentes = vw[st != "OK"][["prefixo_base", "posicao", "numero_fogo_base", "status"]].copy()
    corretos_pct = (corretos_ok / corretos_total * 100.0) if corretos_total else 0.0
    divergentes = int(corretos_total - corretos_ok)

    # --- Teste de KM dos pneus novos (coorte por mês de cadastro no nº de fogo) ---
    # nº de fogo = A MM SSS -> A=ano(6=2026), MM=mês de cadastro, SSS=sequência.
    # Só vida NOVO e sequência <= 100 (exclui recapados e intrusos de outra faixa).
    df_novos = pd.DataFrame(columns=["mescad", "qtd", "km_med", "km_max"])
    pneus_novos_total = 0
    if not pn.empty:
        nv = pn[pn["vida_atual"].astype(str).str.upper() == "NOVO"].copy()
        nv["fogo"] = nv["numero_fogo"].astype(str).str.zfill(6)
        nv["ano"] = nv["fogo"].str[0]
        nv["mescad"] = nv["fogo"].str[1:3]
        nv["seq"] = pd.to_numeric(nv["fogo"].str[3:], errors="coerce")
        nv["km"] = _to_num(nv["km_rodada"])
        ano_ref = str(periodo_fim.year)[-1]
        coh = nv[(nv["ano"] == ano_ref) & (nv["seq"] <= 100) &
                 (nv["mescad"].str.isdigit()) & (nv["mescad"].astype(int).between(1, 12))]
        if not coh.empty:
            df_novos = (coh.groupby("mescad", as_index=False)
                        .agg(qtd=("fogo", "count"), km_med=("km", "mean"), km_max=("km", "max"))
                        .sort_values("mescad"))
            pneus_novos_total = int(coh.shape[0])

    return {
        "mes_ref": mes_ref,
        "trocas_mes": trocas_mes, "trocas_trimestre": trocas_trimestre,
        "trocas_por_mes": trocas_por_mes, "tipo_troca": tipo_troca,
        "estoque_transnet": estoque_transnet, "estoque_vida": estoque_vida,
        "novos_estoque": novos_estoque, "recap_estoque": recap_estoque,
        "estoque_fisico": estoque_fisico,
        "corretos_ok": corretos_ok, "corretos_total": corretos_total,
        "corretos_pct": corretos_pct, "divergentes": divergentes,
        "df_divergentes": df_divergentes,
        "df_pneus_novos": df_novos, "pneus_novos_total": pneus_novos_total,
    }


# ==============================================================================
# PROCESSAMENTO - SOLICITAÇÃO DE REPARO (competência + por grupo · Supabase A)
# ==============================================================================
def processar_solicitacao_reparo(periodo_fim: date) -> dict:
    """Solicitações de reparo (tabela solicitacao_reparo do Supabase A).

    cs_situacao: A=atendida, I=improcedente, N=não atendida (aberta).
    status_competencia: 'fechado' = SR fechada até o dia 3 do mês seguinte
    (populado pela view no banco). Aderência por competência = fechado/total do mês.
    """
    sb = _sb_a()
    df = _fetch_all_rows(sb, "solicitacao_reparo",
                         "cd_reclamacao, dt_reclamacao, cs_situacao, "
                         "ds_motivo_reclamacao, status_competencia")
    vazio = {
        "competencia_mensal": [], "meta_competencia": float(os.getenv("REPORT_SR_META", "94")),
        "situacao_atual": {}, "situacao_anterior": {},
        "mes_atual_label": pt_month_name(periodo_fim)[:3].upper(),
        "mes_anterior_label": pt_month_name(add_months(periodo_fim, -1))[:3].upper(),
        "aberto_total": 0, "buckets_aberto": {}, "aberto_por_grupo": pd.DataFrame(),
        "aderencia_por_grupo": pd.DataFrame(), "mais_antiga_dias": 0,
    }
    if df.empty:
        return vazio

    df["dtr"] = pd.to_datetime(df["dt_reclamacao"], errors="coerce")
    df["mesp"] = df["dtr"].dt.to_period("M")
    df["fechado"] = df["status_competencia"].astype(str).str.lower() == "fechado"
    df["sit"] = df["cs_situacao"].astype(str).str.upper()
    df["grupo"] = df["ds_motivo_reclamacao"].astype(str).str.strip().str.upper()

    # Aderência por competência (mês a mês, ano corrente)
    ano = periodo_fim.year
    comp = []
    d = date(ano, 1, 1)
    while d <= periodo_fim:
        g = df[df["mesp"] == pd.Period(d, "M")]
        if len(g):
            comp.append({
                "mes": f"{pt_month_name(d)[:3].upper()}",
                "total": int(len(g)), "fechado": int(g["fechado"].sum()),
                "pct": float(g["fechado"].sum() / len(g) * 100.0),
                "parcial": (d.year == periodo_fim.year and d.month == periodo_fim.month),
            })
        d = add_months(d, 1)

    def sit_counts(dt_ref):
        g = df[df["mesp"] == pd.Period(dt_ref, "M")]
        vc = g["sit"].value_counts().to_dict()
        return {"A": int(vc.get("A", 0)), "I": int(vc.get("I", 0)), "N": int(vc.get("N", 0)),
                "total": int(len(g))}

    # Abertas (não atendidas) — foto atual
    ab = df[df["sit"] == "N"].copy()
    hoje = pd.Timestamp(periodo_fim)
    ab["idade"] = (hoje - ab["dtr"]).dt.days.clip(lower=0)
    labs = ["1-5", "6-10", "11-15", "16-20", "21-59", ">60"]
    buckets = {}
    aberto_por_grupo = pd.DataFrame()
    if not ab.empty:
        ab["bucket"] = pd.cut(ab["idade"], bins=[-1, 5, 10, 15, 20, 59, 10**9], labels=labs)
        buckets = {k: int(v) for k, v in ab["bucket"].value_counts().reindex(labs).fillna(0).items()}
        aberto_por_grupo = (ab.groupby("grupo", as_index=False)
                            .agg(abertas=("cd_reclamacao", "count"),
                                 idade_med=("idade", "mean"), mais_antiga=("idade", "max"))
                            .sort_values("abertas", ascending=False))

    # Aderência por grupo (competência, últimos 3 meses)
    ini3 = pd.Timestamp(month_start(add_months(periodo_fim, -2)))
    mj = df[df["dtr"] >= ini3]
    aderencia_por_grupo = pd.DataFrame()
    if not mj.empty:
        aderencia_por_grupo = (mj.groupby("grupo", as_index=False)
                               .agg(n=("cd_reclamacao", "count"), fechado=("fechado", "sum")))
        aderencia_por_grupo["pct"] = (aderencia_por_grupo["fechado"] /
                                      aderencia_por_grupo["n"] * 100.0)
        aderencia_por_grupo = aderencia_por_grupo[aderencia_por_grupo["n"] >= 15] \
            .sort_values("pct")

    return {
        "competencia_mensal": comp,
        "meta_competencia": float(os.getenv("REPORT_SR_META", "94")),
        "situacao_atual": sit_counts(periodo_fim),
        "situacao_anterior": sit_counts(add_months(periodo_fim, -1)),
        "mes_atual_label": pt_month_name(periodo_fim)[:3].upper(),
        "mes_anterior_label": pt_month_name(add_months(periodo_fim, -1))[:3].upper(),
        "aberto_total": int(len(ab)),
        "buckets_aberto": buckets,
        "aberto_por_grupo": aberto_por_grupo,
        "aderencia_por_grupo": aderencia_por_grupo,
        "mais_antiga_dias": int(ab["idade"].max()) if not ab.empty else 0,
    }


# ==============================================================================
# PROCESSAMENTO - OPORTUNIDADES (cruzamentos · SOS + preventivas)
# ==============================================================================
def processar_oportunidades(periodo_fim: date, sr_aberto_total: int = 0) -> dict:
    """Cruzamentos que apontam onde a quebra dava sinal antes de acontecer.

    Base: quebras válidas (SOS) do trimestre.
    1) Quebra repetida no mesmo carro em < 7 dias (retorno pra rua sem resolver).
    2) Quebra em < 15 dias após uma preventiva (revisão não pegou o problema).
    3) Fila de SRs não atendidas hoje (aguardando atendimento).
    """
    periodo_fim = month_end(periodo_fim)
    ini = month_start(add_months(periodo_fim, -2))

    df = carregar_sos_pagina_4(ini, periodo_fim)
    base = pd.DataFrame()
    if not df.empty:
        df["valida"] = df["ocorrencia"].apply(is_ocorrencia_valida_para_mkbf)
        base = df[df["valida"]].copy()
        base["dt"] = pd.to_datetime(base["data_sos"], errors="coerce")
        base["veic"] = base["veiculo"].astype(str).str.strip()
        base = base.dropna(subset=["dt"]).sort_values("dt")

    total = int(len(base))
    rep_7d = 0
    pos_prev_15d = 0
    exemplos_rep = []

    if total:
        # 1) repetida < 7 dias no mesmo carro
        for veic, g in base.groupby("veic"):
            ds = g["dt"].sort_values().tolist()
            probs = g.sort_values("dt")["problema_encontrado"].astype(str).tolist()
            for i in range(1, len(ds)):
                gap = (ds[i] - ds[i - 1]).days
                if 0 <= gap <= 7:
                    rep_7d += 1
                    if len(exemplos_rep) < 6:
                        exemplos_rep.append({"veiculo": veic, "dias": gap, "problema": probs[i]})

        # 2) < 15 dias após preventiva (mesmo prefixo)
        # Fontes UNIDAS — nenhuma das duas é completa sozinha:
        #  - `preventivas` (INOVE/SB_B): lançamento manual no app. Histórico mais denso,
        #    mas subnotifica (semana de 13-18/07/2026: 12 registros para 25 execuções).
        #  - `ultimo_plano` (TransNet/SB_A): vem do sistema de OS, autoritativa, porém é
        #    snapshot do ÚLTIMO plano por veículo×tipo — não guarda todo o histórico.
        # Como o indicador só pergunta "houve preventiva neste veículo nesta data?",
        # a união maximiza a cobertura. Subestimar aqui faz a manutenção parecer melhor
        # do que é (quebra pós-preventiva não atribuída).
        datas_prev = []  # lista de (veiculo, timestamp)
        try:
            prev = _fetch_all_rows(_sb_b(), "preventivas", "prefixo, data_realizacao")
        except Exception:
            prev = pd.DataFrame()
        if not prev.empty:
            prev["dt"] = pd.to_datetime(prev["data_realizacao"], errors="coerce")
            prev["veic"] = prev["prefixo"].astype(str).str.strip()
            prev = prev.dropna(subset=["dt"])
            datas_prev += list(zip(prev["veic"], prev["dt"]))

        try:
            pl = _fetch_all_rows(_sb_a(), "ultimo_plano",
                                 "nr_ordem, cd_ordem_servico, dt_abertura_os, ds_plano")
        except Exception:
            pl = pd.DataFrame()
        if not pl.empty:
            pl["_p"] = (pl["ds_plano"].astype(str)
                        .str.normalize("NFKD").str.encode("ascii", "ignore")
                        .str.decode("ascii").str.upper())
            # só OS de preventiva/inspeção (ignora corretiva, garantia isolada etc.)
            eh_prev = (pl["_p"].str.contains("REVISAO PESADA", regex=False)
                       | pl["_p"].str.contains("INSPECAO 5.000", regex=False))
            os_prev = pl.loc[eh_prev, "cd_ordem_servico"].unique()
            pl = pl[pl["cd_ordem_servico"].isin(os_prev)].copy()
            pl["dt"] = pd.to_datetime(pl["dt_abertura_os"].astype(str).str[:10], errors="coerce")
            pl["veic"] = pl["nr_ordem"].astype(str).str.strip()
            pl = pl.dropna(subset=["dt"]).drop_duplicates(subset=["cd_ordem_servico"])
            datas_prev += list(zip(pl["veic"], pl["dt"]))

        if datas_prev:
            pmap = {}
            for v, dt in datas_prev:
                pmap.setdefault(v, set()).add(dt)
            pmap = {v: sorted(s) for v, s in pmap.items()}
            for _, r in base.iterrows():
                datas = [d for d in pmap.get(r["veic"], []) if d <= r["dt"]]
                if not datas:
                    continue
                # preventiva MAIS RECENTE antes da quebra
                gap = (r["dt"] - max(datas)).days
                if 0 <= gap <= 15:
                    pos_prev_15d += 1

    def pct(n):
        return float(n / total * 100.0) if total else 0.0

    return {
        "total_quebras": total,
        "rep_7d": rep_7d, "rep_7d_pct": pct(rep_7d),
        "pos_prev_15d": pos_prev_15d, "pos_prev_15d_pct": pct(pos_prev_15d),
        "exemplos_rep": exemplos_rep,
        "fila_srs": int(sr_aberto_total),
    }


# ==============================================================================
# GRÁFICOS
# ==============================================================================
# Paleta teal (usada também pelos gráficos reaproveitados abaixo)
_C_TEAL = "#0d9488"
_C_TEAL_DARK = "#0f3d38"
_C_LIGHT = "#cbd5d5"
_C_RED = "#dc2626"
_C_INK = "#123b35"
_C_MUTE = "#5b716c"


def gerar_grafico_mkbf_historico(df_hist: pd.DataFrame, caminho_img: Path):
    df = df_hist.copy()
    if df.empty:
        _empty_chart(caminho_img, "", figsize=(10.5, 3.0))
        return

    x = range(len(df))
    y_mkbf = df["mkbf"].tolist()
    y_meta = df["meta"].tolist()

    fig, ax = plt.subplots(figsize=(10.5, 3.2))
    ax.plot(x, y_mkbf, marker="o", markersize=5, linewidth=2.4, label="MKBF", color=_C_TEAL)
    ax.fill_between(x, y_mkbf, alpha=0.10, color=_C_TEAL)
    ax.plot(x, y_meta, linewidth=1.8, linestyle="--", label="Meta", color=_C_RED)

    offset_val = max(max(y_mkbf + y_meta) * 0.05, 100) if (y_mkbf + y_meta) else 100
    for i, v in enumerate(y_mkbf):
        ax.text(i, v + offset_val * 0.25, f"{v:,.0f}".replace(",", "."), ha="center", va="bottom",
                fontsize=7.5, fontweight="bold", color=_C_INK)
    ax.set_xticks(list(x))
    ax.set_xticklabels(df["mes_label"].tolist(), fontsize=7.5)
    ax.set_yticks([])
    ax.set_ylim(0, max(y_mkbf + y_meta) * 1.28)
    ax.grid(True, linestyle=":", alpha=0.5, axis="y")
    _teal_axes_style(ax)
    ax.spines["left"].set_visible(False)
    ax.legend(loc="upper left", fontsize=8, frameon=False)
    fig.tight_layout(pad=0.4)
    plt.savefig(caminho_img, dpi=140, bbox_inches="tight", transparent=True)
    plt.close()


def gerar_grafico_pagina_2(dados: dict, caminho_img: Path):
    df = dados["diario"].copy()
    if df.empty:
        _empty_chart(caminho_img, "", figsize=(10.5, 3.0))
        return

    fig, ax1 = plt.subplots(figsize=(10.5, 3.2))
    x = range(len(df))
    labels = df["dia"].tolist()
    interv = df["intervencoes"].tolist()
    mkbf = df["mkbf"].tolist()

    ax1.bar(x, interv, label="Intervenções", color=_C_TEAL, alpha=0.9, width=0.6)
    ax1.set_xticks(list(x))
    ax1.set_xticklabels(labels, rotation=45, fontsize=6.5, ha="right")
    ax1.grid(True, axis="y", linestyle=":", alpha=0.5)
    max_interv = max(interv) if interv else 1
    ax1.set_ylim(0, max_interv * 1.5)
    for i, v in enumerate(interv):
        if v > 0:
            ax1.text(i, v + (max_interv * 0.03), str(v), ha="center", va="bottom", fontsize=6.5, fontweight="bold", color=_C_INK)

    ax2 = ax1.twinx()
    ax2.plot(x, mkbf, marker="o", markersize=3.5, linewidth=1.8, label="MKBF diário", color=_C_RED)
    max_mkbf = max(mkbf) if mkbf else 1
    min_mkbf = min(mkbf) if mkbf else 0
    ax2.set_ylim(min_mkbf * 0.5, max_mkbf * 1.18)

    ax1.tick_params(labelsize=7, colors=_C_MUTE)
    ax2.tick_params(labelsize=7, colors=_C_MUTE)
    for sp in ["top"]:
        ax1.spines[sp].set_visible(False); ax2.spines[sp].set_visible(False)
    ax1.spines["left"].set_color("#d6e3e0"); ax1.spines["bottom"].set_color("#d6e3e0")

    lines_1, labels_1 = ax1.get_legend_handles_labels()
    lines_2, labels_2 = ax2.get_legend_handles_labels()
    ax1.legend(lines_1 + lines_2, labels_1 + labels_2, loc="upper left", fontsize=8, frameon=False)
    fig.tight_layout(pad=0.4)
    plt.savefig(caminho_img, dpi=140, bbox_inches="tight", transparent=True)
    plt.close()


def _grafico_barras_duplas(df, val_col_total, val_col_ref, labels, caminho_img,
                           cor_ref, figsize, rot=0):
    if df.empty:
        _empty_chart(caminho_img, "", figsize=figsize)
        return
    x = range(len(df))
    x_total = [i - 0.2 for i in x]
    x_ref = [i + 0.2 for i in x]
    y_total = df[val_col_total].tolist()
    y_ref = df[val_col_ref].tolist()

    fig, ax = plt.subplots(figsize=figsize)
    ax.bar(x_total, y_total, width=0.4, color=_C_LIGHT, label="Acumulado (3 Meses)")
    ax.bar(x_ref, y_ref, width=0.4, color=cor_ref, label="Mês Atual")
    max_y = max(y_total) if y_total else 1
    ax.set_ylim(0, max_y * 1.32)
    for i, v in enumerate(y_total):
        if v > 0:
            ax.text(x_total[i], v + (max_y * 0.02), str(int(v)), ha="center", va="bottom", fontsize=6, color=_C_MUTE)
    for i, v in enumerate(y_ref):
        if v > 0:
            ax.text(x_ref[i], v + (max_y * 0.02), str(int(v)), ha="center", va="bottom", fontsize=7, fontweight="bold", color=_C_INK)
    ax.set_xticks(list(x))
    ax.set_xticklabels(labels, rotation=rot, fontsize=7, ha="right" if rot else "center")
    ax.set_yticks([])
    for spine in ["top", "right", "left", "bottom"]:
        ax.spines[spine].set_visible(False)
    ax.tick_params(colors=_C_MUTE)
    ax.legend(loc="upper right", fontsize=7, frameon=False)
    fig.tight_layout(pad=0.3)
    plt.savefig(caminho_img, dpi=140, bbox_inches="tight", transparent=True)
    plt.close()


def gerar_grafico_pagina_3_linha(df_linha: pd.DataFrame, caminho_img: Path):
    df = df_linha.copy()
    labels = df["linha"].tolist() if not df.empty else []
    _grafico_barras_duplas(df, "int_total", "int_ref", labels, caminho_img,
                           cor_ref=_C_TEAL_DARK, figsize=(7.6, 2.0), rot=0)


def gerar_grafico_pagina_3_horario(df_horario: pd.DataFrame, caminho_img: Path):
    df = df_horario.copy()
    labels = [f"{int(h):02d}h" for h in df["hora_int"].tolist()] if not df.empty else []
    _grafico_barras_duplas(df, "int_total", "int_ref", labels, caminho_img,
                           cor_ref=_C_TEAL, figsize=(7.6, 2.0), rot=0)


def gerar_grafico_pagina_3_top_carro(df_top_carro: pd.DataFrame, caminho_img: Path):
    df = df_top_carro.copy()
    labels = df["veiculo"].tolist() if not df.empty else []
    _grafico_barras_duplas(df, "int_total", "int_ref", labels, caminho_img,
                           cor_ref=_C_RED, figsize=(4.4, 2.6), rot=45)


# ==============================================================================
# GRÁFICOS - TEMA TEAL (seções novas do consolidado)
# ==============================================================================
TEAL = "#0d9488"
TEAL_DARK = "#0f3d38"
TEAL_LIGHT = "#5eead4"
RED = "#dc2626"
AMBER = "#f59e0b"
GREY = "#94a3a0"


def _teal_axes_style(ax):
    for spine in ["top", "right"]:
        ax.spines[spine].set_visible(False)
    ax.spines["left"].set_color("#d6e3e0")
    ax.spines["bottom"].set_color("#d6e3e0")
    ax.tick_params(colors="#5b716c", labelsize=8)


def _empty_chart(caminho_img: Path, titulo: str, figsize=(9.5, 2.6)):
    plt.figure(figsize=figsize)
    plt.title(titulo, fontsize=11, fontweight="bold", color=TEAL_DARK)
    plt.text(0.5, 0.5, "Sem dados para exibição", ha="center", va="center", transform=plt.gca().transAxes)
    plt.axis("off")
    plt.tight_layout()
    plt.savefig(caminho_img, dpi=140, transparent=True)
    plt.close()


def gerar_grafico_regen_mensal(evolucao_mensal: pd.DataFrame, mes_ref_period, caminho_img: Path):
    df = evolucao_mensal.copy()
    if df.empty:
        _empty_chart(caminho_img, "Custo de Regeneração por Mês")
        return
    df = df.sort_values("mes")
    labels = [f"{pt_month_name(m.to_timestamp().date())[:3]}" for m in df["mes"]]
    custos = df["custo"].tolist()
    cores = [GREY if df["mes"].iloc[i] == mes_ref_period else TEAL for i in range(len(df))]
    fig, ax = plt.subplots(figsize=(9.5, 2.9))
    bars = ax.bar(range(len(df)), custos, color=cores, width=0.6)
    max_v = max(custos) if custos else 1
    for i, v in enumerate(custos):
        ax.text(i, v + max_v * 0.02, f"R$ {v:,.0f}".replace(",", "."), ha="center", va="bottom",
                fontsize=7.5, fontweight="bold", color=TEAL_DARK)
    ax.set_ylim(0, max_v * 1.25)
    ax.set_xticks(range(len(df)))
    ax.set_xticklabels(labels, fontsize=8)
    ax.set_yticks([])
    _teal_axes_style(ax)
    ax.spines["left"].set_visible(False)
    fig.tight_layout(pad=0.3)
    plt.savefig(caminho_img, dpi=140, bbox_inches="tight", transparent=True)
    plt.close()


def gerar_grafico_gns_diario(df_diario: pd.DataFrame, gns_medio: float, caminho_img: Path):
    df = df_diario.copy()
    if df.empty:
        _empty_chart(caminho_img, "GNS por Dia")
        return
    df["dia"] = pd.to_datetime(df["data"]).dt.strftime("%d")
    cores = [TEAL_DARK if u else "#cbd5d5" for u in df["util"]]
    vals = df["gns"].tolist()
    fig, ax = plt.subplots(figsize=(9.5, 2.4))
    ax.bar(range(len(df)), vals, color=cores, width=0.6)
    max_v = max(vals) if vals else 1
    for i, v in enumerate(vals):
        ax.text(i, v + max_v * 0.03, str(int(v)), ha="center", va="bottom", fontsize=7, fontweight="bold", color="#1f2937")
    if gns_medio > 0:
        ax.axhline(gns_medio, color=RED, linestyle="--", linewidth=1.3)
        ax.text(len(df) - 0.5, gns_medio + max_v * 0.04, f"Média {gns_medio:.1f}", color=RED, fontsize=8, fontweight="bold")
    ax.set_ylim(0, max_v * 1.25)
    ax.set_xticks(range(len(df)))
    ax.set_xticklabels(df["dia"].tolist(), fontsize=6.5)
    ax.set_yticks([])
    _teal_axes_style(ax)
    ax.spines["left"].set_visible(False)
    fig.tight_layout(pad=0.3)
    plt.savefig(caminho_img, dpi=140, bbox_inches="tight", transparent=True)
    plt.close()


def gerar_grafico_sr_aderencia(competencia_mensal: list, meta: float, caminho_img: Path):
    if not competencia_mensal:
        _empty_chart(caminho_img, "Evolução da Aderência por Competência")
        return
    labels = [c["mes"] for c in competencia_mensal]
    pcts = [c["pct"] for c in competencia_mensal]
    parcial = [c.get("parcial", False) for c in competencia_mensal]
    fig, ax = plt.subplots(figsize=(9.5, 2.6))
    ax.plot(range(len(labels)), pcts, marker="o", linewidth=2.2, color=TEAL, zorder=3)
    ax.fill_between(range(len(labels)), pcts, alpha=0.10, color=TEAL)
    ax.axhline(meta, color=RED, linestyle="--", linewidth=1.5, label=f"Meta {meta:.0f}%")
    for i, v in enumerate(pcts):
        cor = AMBER if parcial[i] else (RED if v < meta else TEAL_DARK)
        ax.scatter([i], [v], color=cor, zorder=4, s=26)
        ax.text(i, v + 3.5, f"{v:.1f}%".replace(".", ","), ha="center", fontsize=7.5, fontweight="bold", color=cor)
    ax.set_xticks(range(len(labels)))
    ax.set_xticklabels(labels, fontsize=8)
    ax.set_ylim(0, 118)
    ax.set_yticks([])
    ax.legend(loc="lower left", fontsize=8, frameon=False)
    _teal_axes_style(ax)
    ax.spines["left"].set_visible(False)
    fig.tight_layout(pad=0.3)
    plt.savefig(caminho_img, dpi=140, bbox_inches="tight", transparent=True)
    plt.close()


def gerar_grafico_sr_aging(buckets: dict, caminho_img: Path):
    labs = ["1-5", "6-10", "11-15", "16-20", "21-59", ">60"]
    vals = [int(buckets.get(k, 0)) for k in labs]
    cores = [TEAL_DARK, TEAL, TEAL, AMBER, RED, RED]
    fig, ax = plt.subplots(figsize=(7.0, 1.9))
    ax.bar(range(len(labs)), vals, color=cores, width=0.62)
    max_v = max(vals) if any(vals) else 1
    for i, v in enumerate(vals):
        if v > 0:
            ax.text(i, v + max_v * 0.03, str(v), ha="center", va="bottom", fontsize=8, fontweight="bold", color="#1f2937")
    ax.set_ylim(0, max_v * 1.22)
    ax.set_xticks(range(len(labs)))
    ax.set_xticklabels([f"{l} dias" for l in labs], fontsize=7)
    ax.set_yticks([])
    _teal_axes_style(ax)
    ax.spines["left"].set_visible(False)
    fig.tight_layout(pad=0.3)
    plt.savefig(caminho_img, dpi=140, bbox_inches="tight", transparent=True)
    plt.close()


def gerar_grafico_embarcados_mensal(por_mes: pd.DataFrame, mes_ref_period, caminho_img: Path):
    df = por_mes.copy()
    if df.empty:
        _empty_chart(caminho_img, "Solicitações por Mês", figsize=(5.2, 2.8))
        return
    df = df.sort_values("mes").tail(6)
    labels = [f"{pt_month_name(m.to_timestamp().date())[:3]}" for m in df["mes"]]
    qtd = df["qtd"].tolist()
    cores = [GREY if df["mes"].iloc[i] == mes_ref_period else TEAL for i in range(len(df))]
    fig, ax = plt.subplots(figsize=(5.2, 2.4))
    ax.bar(range(len(df)), qtd, color=cores, width=0.55)
    max_v = max(qtd) if qtd else 1
    for i, v in enumerate(qtd):
        ax.text(i, v + max_v * 0.02, str(int(v)), ha="center", va="bottom", fontsize=8, fontweight="bold", color=TEAL_DARK)
    ax.set_ylim(0, max_v * 1.22)
    ax.set_xticks(range(len(df)))
    ax.set_xticklabels(labels, fontsize=8)
    ax.set_yticks([])
    _teal_axes_style(ax)
    ax.spines["left"].set_visible(False)
    fig.tight_layout(pad=0.3)
    plt.savefig(caminho_img, dpi=140, bbox_inches="tight", transparent=True)
    plt.close()


def gerar_grafico_motoristas_improcedentes(impro_mes: pd.DataFrame, ano: int, caminho_img: Path):
    df = impro_mes.copy()
    if df.empty:
        _empty_chart(caminho_img, "Improcedentes por Mês", figsize=(9.0, 2.6))
        return
    df = df.sort_values("mes")
    meses_pt = ["", "JAN", "FEV", "MAR", "ABR", "MAI", "JUN", "JUL", "AGO", "SET", "OUT", "NOV", "DEZ"]
    labels = [meses_pt[int(m)] for m in df["mes"]]
    qtd = df["qtd"].tolist()
    fig, ax = plt.subplots(figsize=(9.0, 2.4))
    ax.plot(range(len(labels)), qtd, marker="o", linewidth=2.0, color=AMBER)
    ax.fill_between(range(len(labels)), qtd, alpha=0.10, color=AMBER)
    max_v = max(qtd) if qtd else 1
    for i, v in enumerate(qtd):
        ax.text(i, v + max_v * 0.05 + 0.15, str(int(v)), ha="center", fontsize=8, fontweight="bold", color="#92400e")
    ax.set_ylim(0, max_v * 1.25 + 0.5)
    ax.set_xticks(range(len(labels)))
    ax.set_xticklabels(labels, fontsize=8)
    ax.set_yticks([])
    _teal_axes_style(ax)
    ax.spines["left"].set_visible(False)
    fig.tight_layout(pad=0.3)
    plt.savefig(caminho_img, dpi=140, bbox_inches="tight", transparent=True)
    plt.close()


def gerar_grafico_borracharia_trocas(trocas_por_mes: dict, mes_ref: str, caminho_img: Path):
    if not trocas_por_mes:
        _empty_chart(caminho_img, "Trocas de Pneu por Mês", figsize=(5.2, 2.8))
        return
    itens = sorted(trocas_por_mes.items())[-6:]  # últimos meses
    labels = []
    for k, _ in itens:
        y, m = k.split("-")
        labels.append(f"{pt_month_name(date(int(y), int(m), 1))[:3]}")
    qtd = [v for _, v in itens]
    cores = [GREY if k == mes_ref else TEAL for k, _ in itens]
    fig, ax = plt.subplots(figsize=(5.2, 2.4))
    ax.bar(range(len(itens)), qtd, color=cores, width=0.55)
    max_v = max(qtd) if qtd else 1
    for i, v in enumerate(qtd):
        ax.text(i, v + max_v * 0.02, str(int(v)), ha="center", va="bottom", fontsize=8, fontweight="bold", color=TEAL_DARK)
    ax.set_ylim(0, max_v * 1.22)
    ax.set_xticks(range(len(itens)))
    ax.set_xticklabels(labels, fontsize=8)
    ax.set_yticks([])
    _teal_axes_style(ax)
    ax.spines["left"].set_visible(False)
    fig.tight_layout(pad=0.3)
    plt.savefig(caminho_img, dpi=140, bbox_inches="tight", transparent=True)
    plt.close()


# ==============================================================================
# CONSIDERAÇÕES IA E FALLBACK
# ==============================================================================
def gerar_consideracoes_fallback_p1(dados: dict) -> str:
    atual = dados["resumo_atual"]
    var = dados["variacoes"]
    ader = dados["aderencia_meta_pct"]

    top_motivos = dados["df_motivos"].head(3).copy()
    motivos_txt = ", ".join(
        [f"{r['tipo']} ({int(r['mes_atual'])})" for _, r in top_motivos.iterrows() if int(r["mes_atual"]) > 0]
    )
    if not motivos_txt:
        motivos_txt = "sem concentração relevante de ofensores"

    tendencia_mkbf = "melhora" if var["mkbf_pct"] > 0 else ("queda" if var["mkbf_pct"] < 0 else "estabilidade")
    meta_txt = "acima" if atual["mkbf"] >= MKBF_META else "abaixo"

    return (
        f"No período de {dados['periodo_label']}, a operação registrou "
        f"{atual['intervencoes']} intervenções válidas para MKBF, com "
        f"{_fmt_int(atual['km_total'])} km rodados e MKBF de {_fmt_int(atual['mkbf'])}. "
        f"Na comparação com {dados['mes_anterior_label']}, houve {tendencia_mkbf} no indicador, "
        f"com variação de {_fmt_pct(var['mkbf_pct'])}. "
        f"A aderência frente à meta de {_fmt_int(MKBF_META)} ficou em {ader:.1f}%, "
        f"mantendo o resultado {meta_txt} do patamar esperado. "
        f"Os principais ofensores do mês foram {motivos_txt}."
    )

def gerar_consideracoes_ia_p1(dados: dict) -> str:
    if not VERTEX_PROJECT_ID or vertexai is None or GenerativeModel is None:
        return gerar_consideracoes_fallback_p1(dados)

    try:
        _ensure_vertex_adc_if_possible()
        vertexai.init(project=VERTEX_PROJECT_ID, location=VERTEX_LOCATION)
        model = GenerativeModel(VERTEX_MODEL)

        atual = dados["resumo_atual"]
        ant = dados["resumo_ant"]
        var = dados["variacoes"]
        top_motivos = dados["df_motivos"].head(5).to_dict(orient="records")

        prompt = f"""
Você é um gerente executivo de manutenção de frota.
Escreva uma consideração executiva curta, objetiva e profissional, em português do Brasil,
com foco em confiabilidade operacional.

DADOS:
- Período: {dados['periodo_label']}
- Mês atual: {dados['mes_atual_label']}
- Mês anterior: {dados['mes_anterior_label']}
- Intervenções mês atual: {atual['intervencoes']}
- Intervenções mês anterior: {ant['intervencoes']}
- KM rodado mês atual: {atual['km_total']}
- KM rodado mês anterior: {ant['km_total']}
- MKBF mês atual: {atual['mkbf']}
- MKBF mês anterior: {ant['mkbf']}
- Variação MKBF: {var['mkbf_pct']:.2f}%
- Meta MKBF: {MKBF_META}
- Aderência à meta: {dados['aderencia_meta_pct']:.2f}%
- Principais ofensores: {top_motivos}

REGRAS:
- Máximo de 110 palavras.
- Não invente fatos.
- Não use markdown.
- Linguagem executiva e natural.
- Cite se o resultado ficou acima ou abaixo da meta.
"""
        resp = model.generate_content(prompt)
        texto = getattr(resp, "text", None) or ""
        texto = texto.strip().replace("```", "")
        return texto if texto else gerar_consideracoes_fallback_p1(dados)

    except Exception as e:
        print("⚠️ Erro na IA P1:", repr(e))
        return gerar_consideracoes_fallback_p1(dados)


def gerar_consideracoes_fallback_p2(dados: dict) -> str:
    df = dados["diario"].copy()
    if not df.empty:
        df["dt"] = pd.to_datetime(df["data"], dayfirst=True, errors="coerce")
        wk = df["dt"].dt.weekday
        int_bd = int(df[wk < 5]["intervencoes"].sum())
        int_fds = int(df[wk >= 5]["intervencoes"].sum())
    else:
        int_bd = int_fds = 0

    media_dia = dados["media_interv_dia"]
    meta_mes = dados["meta_interv_mes"]
    delta = dados["delta_interv"]
    status_meta = "acima da meta de intervenções" if delta > 0 else "dentro da meta de intervenções"
    direcao = "pressiona" if delta > 0 else "favorece"

    return (
        f"No período de {dados['periodo_label']}, a média diária observada foi de {media_dia:.2f} "
        f"intervenções/dia, com projeção {status_meta}. A distribuição aponta {int_bd} quebras em dias úteis "
        f"e {int_fds} aos finais de semana. O comportamento diário {direcao} diretamente a "
        f"confiabilidade operacional. O acompanhamento contínuo é essencial para antecipar ações corretivas."
    )

def gerar_consideracoes_ia_p2(dados: dict) -> str:
    if not VERTEX_PROJECT_ID or vertexai is None or GenerativeModel is None:
        return gerar_consideracoes_fallback_p2(dados)

    try:
        _ensure_vertex_adc_if_possible()
        vertexai.init(project=VERTEX_PROJECT_ID, location=VERTEX_LOCATION)
        model = GenerativeModel(VERTEX_MODEL)

        df = dados["diario"].copy()
        if not df.empty:
            df["dt"] = pd.to_datetime(df["data"], dayfirst=True, errors="coerce")
            wk = df["dt"].dt.weekday
            int_bd = int(df[wk < 5]["intervencoes"].sum())
            int_sat = int(df[wk == 5]["intervencoes"].sum())
            int_sun = int(df[wk == 6]["intervencoes"].sum())
        else:
            int_bd = int_sat = int_sun = 0

        status_proj = "ALERTA (projeção supera a meta)" if dados["proj_interv_mes"] > dados["meta_interv_mes"] else "DENTRO DO ESPERADO"

        prompt = f"""
Você é um gerente executivo de manutenção de frota.
Escreva uma consideração executiva curta, objetiva e profissional, em português do Brasil.

DADOS GERAIS:
- Período: {dados['periodo_label']}
- Total de intervenções no período: {dados['total_interv']}
- Meta de intervenções para o mês: {dados['meta_interv_mes']:.1f}
- Projeção de intervenções até o fim do mês: {dados['proj_interv_mes']:.1f}
- Status da Projeção vs Meta: {status_proj}

DISTRIBUIÇÃO POR DIA DA SEMANA (Foco da Análise):
- Dias Úteis (Segunda a Sexta): {int_bd} ocorrências
- Sábados: {int_sat} ocorrências
- Domingos: {int_sun} ocorrências

REGRAS OBRIGATÓRIAS:
- Fale OBRIGATORIAMENTE sobre o volume de quebras nos dias úteis comparado aos finais de semana (sábado e domingo).
- Analise se essa tendência diária está pressionando ou favorecendo a meta e a confiabilidade.
- Máximo de 110 palavras.
- Não invente fatos, use apenas os dados fornecidos.
- Linguagem técnica e direta. Sem usar sintaxe markdown.
"""
        resp = model.generate_content(prompt)
        texto = getattr(resp, "text", None) or ""
        texto = texto.strip().replace("```", "")
        return texto if texto else gerar_consideracoes_fallback_p2(dados)

    except Exception as e:
        print("⚠️ Erro na IA P2:", repr(e))
        return gerar_consideracoes_fallback_p2(dados)


def gerar_consideracoes_fallback_p3(dados: dict) -> str:
    return (
        f"No mês atual ({dados['mes_ref_label']}), a operação registrou "
        f"{_fmt_int(dados['total_interv_ref'])} intervenções. A análise aponta a variação e concentração "
        f"das ocorrências de forma direta frente aos últimos meses, direcionando o foco das ações corretivas."
    )

def gerar_consideracoes_ia_p3(dados: dict) -> str:
    if not VERTEX_PROJECT_ID or vertexai is None or GenerativeModel is None:
        return gerar_consideracoes_fallback_p3(dados)
    
    try:
        _ensure_vertex_adc_if_possible()
        vertexai.init(project=VERTEX_PROJECT_ID, location=VERTEX_LOCATION)
        model = GenerativeModel(VERTEX_MODEL)

        top_linha = dados["df_linha"].iloc[0] if not dados["df_linha"].empty else None
        top_carro = dados["df_top_carro"].iloc[0] if not dados["df_top_carro"].empty else None
        
        info_linha = f"A linha {top_linha['linha']} foi o maior ofensor do mês com {top_linha['int_ref']} quebras." if top_linha is not None else "Sem dados de linha."
        info_carro = f"O carro {top_carro['veiculo']} foi o mais ofensor no mês com {top_carro['int_ref']} falhas." if top_carro is not None else "Sem dados de carro."

        prompt = f"""
Você é um gerente executivo de manutenção de frota.
Escreva uma consideração executiva focada ESTRITAMENTE na Análise Estratégica do mês atual.

DADOS:
- Mês de Referência: {dados['mes_ref_label']}
- Total Intervenções Mês Ref: {dados['total_interv_ref']}
- Total Intervenções Acumulado (3 Meses): {dados['total_interv']}
- Detalhe Ofensores Mês Ref: {info_linha} | {info_carro}

REGRAS:
- A Análise SEMPRE precisa ser do Mês de Referência. Cite os dados do Acumulado (3 Meses) apenas como fator de alerta.
- Destaque objetivamente o ofensor por linha e por veículo.
- Máximo de 110 palavras.
- Não invente fatos. Linguagem técnica e direta. Sem markdown.
"""
        resp = model.generate_content(prompt)
        texto = getattr(resp, "text", None) or ""
        texto = texto.strip().replace("```", "")
        return texto if texto else gerar_consideracoes_fallback_p3(dados)

    except Exception as e:
        print("⚠️ Erro na IA P3:", repr(e))
        return gerar_consideracoes_fallback_p3(dados)


def gerar_consideracoes_fallback_p4(dados: dict) -> str:
    return (
        f"A análise detalhada dos últimos 3 meses ({dados['periodo_label']}) indica {dados['total_interv']} intervenções "
        f"acumuladas. O foco de correção recai principalmente sobre as linhas e os veículos reincidentes mapeados abaixo, "
        f"evidenciando a necessidade de revisão no setor de {dados['top_setor']} com ênfase no defeito: {dados['top_defeito']}."
    )

def gerar_consideracoes_ia_p4(dados: dict) -> str:
    if not VERTEX_PROJECT_ID or vertexai is None or GenerativeModel is None:
        return gerar_consideracoes_fallback_p4(dados)
    
    try:
        _ensure_vertex_adc_if_possible()
        vertexai.init(project=VERTEX_PROJECT_ID, location=VERTEX_LOCATION)
        model = GenerativeModel(VERTEX_MODEL)

        top_linhas_txt = ", ".join([f"{l['linha']} ({l['total']})" for l in dados["top_5_linhas"]])
        top_carros_txt = ", ".join([f"{c['veiculo']} ({c['total']})" for c in dados["top_5_carros"]])

        prompt = f"""
Você é um gerente executivo de manutenção de frota. Escreva uma consideração executiva focada no Raio-X de Defeitos e Ofensores.

DADOS:
- Período consolidado: {dados['periodo_label']} (3 Meses)
- Total de Intervenções no período: {dados['total_interv']}
- Principal Defeito causador: {dados['top_defeito']}
- Principal Setor acionado: {dados['top_setor']}
- Pior Veículo ofensor: {dados['top_veiculo']}
- Top 5 Linhas que mais quebram: {top_linhas_txt}
- Top 5 Veículos reincidentes: {top_carros_txt}

REGRAS:
- Comente sobre as principais causas de falhas (defeitos/setores) e indique o impacto das linhas e veículos mais críticos.
- Direcione o foco das ações corretivas.
- Máximo de 110 palavras.
- Não invente fatos. Linguagem técnica e executiva. Sem markdown.
"""
        resp = model.generate_content(prompt)
        texto = getattr(resp, "text", None) or ""
        texto = texto.strip().replace("```", "")
        return texto if texto else gerar_consideracoes_fallback_p4(dados)

    except Exception as e:
        print("⚠️ Erro na IA P4:", repr(e))
        return gerar_consideracoes_fallback_p4(dados)


# ==============================================================================
# HTML E PDF - RELATÓRIO COMPLETO
# ==============================================================================
def gerar_html_relatorio_completo(
    dados_p1: dict, dados_p2: dict, dados_p3: dict, dados_p4: dict,
    img_path_1: Path, img_path_2: Path,
    img_p3_linha: Path, img_p3_horario: Path, img_p3_top: Path,
    html_path: Path
):
    # ---- DADOS PÁGINA 1 ----
    atual = dados_p1["resumo_atual"]
    ant = dados_p1["resumo_ant"]
    var = dados_p1["variacoes"]
    ader = dados_p1["aderencia_meta_pct"]
    motivos = dados_p1["df_motivos"].copy()
    cons_p1 = gerar_consideracoes_ia_p1(dados_p1)
    
    status_text_p1 = "ATINGIU" if atual["mkbf"] >= MKBF_META else "ABAIXO"
    status_bg_p1 = "#dcfce7" if atual["mkbf"] >= MKBF_META else "#fee2e2"
    status_fg_p1 = "#166534" if atual["mkbf"] >= MKBF_META else "#991b1b"

    rows_motivos = ""
    for _, r in motivos.iterrows():
        rows_motivos += f"""
        <tr>
            <td style="text-align: left; padding-left: 8px;">{r['tipo']}</td>
            <td>{_fmt_int(r['mes_anterior'])}</td>
            <td style="font-weight:700;">{_fmt_int(r['mes_atual'])}</td>
        </tr>
        """

    # ---- DADOS PÁGINA 2 ----
    cons_p2 = gerar_consideracoes_ia_p2(dados_p2)
    status_proj = "ALERTA" if dados_p2["proj_interv_mes"] > dados_p2["meta_interv_mes"] else "DENTRO DO ESPERADO"
    status_bg_proj = "#fee2e2" if dados_p2["proj_interv_mes"] > dados_p2["meta_interv_mes"] else "#dcfce7"
    status_fg_proj = "#991b1b" if dados_p2["proj_interv_mes"] > dados_p2["meta_interv_mes"] else "#166534"
    cor_delta = "#dc2626" if dados_p2["delta_interv"] > 0 else "#16a34a"
    sinal_delta = "+" if dados_p2["delta_interv"] > 0 else ""

    # ---- DADOS PÁGINA 3 ----
    df_cluster = dados_p3["df_cluster"].copy()
    cons_p3 = gerar_consideracoes_ia_p3(dados_p3)
    
    lbl_m1 = dados_p3['meses_labels'][0]
    lbl_m2 = dados_p3['meses_labels'][1]
    lbl_m3 = dados_p3['meses_labels'][2]

    rows_cluster = ""
    for _, r in df_cluster.iterrows():
        rows_cluster += f"""
        <tr>
            <td style="font-weight:bold; text-align: left; padding-left:8px;">{r['cluster']}</td>
            <td>{int(r[lbl_m1])}</td>
            <td>{int(r[lbl_m2])}</td>
            <td style="font-weight:700; color:#1e3a8a;">{int(r[lbl_m3])}</td>
            <td>{r['int_veiculo_ref']:.2f}</td>
            <td>{int(r['frota_ref'])}</td>
        </tr>
        """
    total_interv_cluster_ref = _fmt_int(df_cluster[lbl_m3].sum()) if not df_cluster.empty else "0"

    # ---- DADOS PÁGINA 4 ----
    cons_p4 = gerar_consideracoes_ia_p4(dados_p4)
    
    rows_linhas_p4 = ""
    for l in dados_p4["top_5_linhas"]:
        rows_linhas_p4 += f"""
        <tr>
            <td style="font-weight:bold; text-align:left; padding-left:8px;">{l['linha']}</td>
            <td style="font-weight:bold; color:#dc2626;">{l['total']}</td>
            <td style="text-align:left;">{l['maior_defeito']}</td>
        </tr>
        """
        
    rows_carros_p4 = ""
    for c in dados_p4["top_5_carros"]:
        rows_carros_p4 += f"""
        <tr>
            <td style="font-weight:bold; color:#1e3a8a;">{c['veiculo']}</td>
            <td style="font-weight:bold;">{c['total']}</td>
            <td>{c['m1']}</td>
            <td>{c['m2']}</td>
            <td style="font-weight:bold; color:#dc2626;">{c['m3']}</td>
            <td>{c['linha_principal']}</td>
            <td>{c['setor_principal']}</td>
            <td style="text-align:left; font-size:8px;">{c['top_defeitos']}</td>
        </tr>
        """

    footer_right = f"Relatório ID: {REPORT_ID}" if REPORT_ID else "Flash Report Manutenção"

    html = f"""
    <!DOCTYPE html>
    <html lang="pt-BR">
    <head>
      <meta charset="UTF-8" />
      <title>Flash Report Manutenção</title>
      <style>
        * {{ box-sizing: border-box; }}
        body {{ margin: 0; font-family: Arial, Helvetica, sans-serif; background: #eef2f7; color: #111827; }}
        .page {{
          width: 210mm; min-height: 297mm; margin: 0 auto;
          background: radial-gradient(circle at top right, rgba(37,99,235,0.06), transparent 22%), linear-gradient(180deg, #ffffff 0%, #fbfcfe 100%);
          padding: 8mm 10mm 8mm 10mm; position: relative;
        }}
        .page-break {{ page-break-before: always; }}
        .header {{ display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 4px solid #0f172a; padding-bottom: 8px; margin-bottom: 12px; }}
        .title h1 {{ margin: 0; font-size: 24px; line-height: 1; letter-spacing: 0.3px; color: #0f172a; }}
        .title .sub {{ margin-top: 6px; font-size: 11px; color: #475569; }}
        .period-box {{ min-width: 220px; text-align: right; background: linear-gradient(135deg, #0f172a 0%, #1e3a8a 100%); color: white; padding: 10px 12px; border-radius: 14px; box-shadow: 0 10px 24px rgba(15,23,42,0.16); }}
        .period-box .ref {{ font-size: 10px; text-transform: uppercase; font-weight: 700; opacity: 0.8; }}
        .period-box .val {{ font-size: 18px; font-weight: 800; margin-top: 3px; }}
        
        .grid-top {{ display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-bottom: 12px; }}
        .grid-top-p3 {{ display: grid; grid-template-columns: 1fr 1.35fr; gap: 12px; margin-bottom: 12px; align-items: start; }}
        
        .card {{ border: 1px solid #dbe3ee; border-radius: 14px; overflow: hidden; background: #fff; box-shadow: 0 6px 20px rgba(15,23,42,0.06); }}
        .card-title {{ padding: 10px 12px; background: linear-gradient(90deg, #0f172a 0%, #172554 100%); color: white; font-size: 11px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.8px; }}
        .card-body {{ padding: 12px; }}
        
        table {{ width: 100%; border-collapse: collapse; font-size: 10px; }}
        th {{ background: #eef2f7; color: #0f172a; text-transform: uppercase; font-size: 9px; padding: 6px 4px; border: 1px solid #dbe3ee; text-align: center; }}
        td {{ padding: 6px 4px; border: 1px solid #dbe3ee; vertical-align: middle; text-align: center; word-wrap: break-word; }}
        
        .metric-grid {{ display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; }}
        .metric {{ border: 1px solid #dbe3ee; border-radius: 12px; padding: 10px 8px; background: linear-gradient(180deg, #ffffff 0%, #f8fafc 100%); box-shadow: inset 0 1px 0 rgba(255,255,255,0.8); }}
        .metric .lbl {{ font-size: 9px; color: #64748b; text-transform: uppercase; font-weight: 800; white-space: nowrap; }}
        .metric .val {{ margin-top: 4px; font-size: 18px; font-weight: 800; color: #0f172a; }}
        .metric .aux {{ margin-top: 3px; font-size: 9px; color: #64748b; line-height: 1.1; }}
        
        .metric-wide {{ margin-top: 10px; display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }}
        .badge {{ display: inline-block; padding: 6px 10px; border-radius: 999px; font-size: 11px; font-weight: 800; color: white; background: linear-gradient(90deg, #0f172a 0%, #1e3a8a 100%); box-shadow: 0 6px 14px rgba(30,58,138,0.18); }}
        .muted {{ color: #64748b; }}
        
        .chart-wrap {{ padding: 10px; border: 1px solid #dbe3ee; border-radius: 14px; background: linear-gradient(180deg, #ffffff 0%, #f8fafc 100%); }}
        .chart-wrap img {{ width: 100%; height: auto; display: block; }}
        
        .cons-box {{ margin-top: 12px; border: 1px solid #dbe3ee; border-radius: 14px; background: linear-gradient(180deg, #ffffff 0%, #f8fafc 100%); padding: 12px; box-shadow: 0 6px 20px rgba(15,23,42,0.05); }}
        .cons-title {{ font-size: 11px; font-weight: 800; text-transform: uppercase; margin-bottom: 8px; color: #0f172a; letter-spacing: 0.7px; }}
        .cons-text {{ font-size: 12px; line-height: 1.62; color: #1f2937; text-align: justify; }}
        .footer {{ position: absolute; left: 10mm; right: 10mm; bottom: 6mm; font-size: 10px; color: #64748b; display: flex; justify-content: space-between; border-top: 1px solid #dbe3ee; padding-top: 4px; }}
        @page {{ size: A4; margin: 0; }}
      </style>
    </head>
    <body>
      
      <div class="page">
        <div class="header">
          <div class="title">
            <h1>FLASH REPORT MANUTENÇÃO</h1>
            <div class="sub">Página 1 · Intervenções do mês / MKBF</div>
            <div class="sub">Período analisado: <b>{dados_p1['periodo_label']}</b></div>
          </div>
          <div class="period-box">
            <div class="ref">Mês de referência</div>
            <div class="val">{dados_p1['mes_atual_label']}</div>
          </div>
        </div>

        <div class="grid-top">
          <div class="card">
            <div class="card-title">Comparativo mensal</div>
            <div class="card-body">
              <table>
                <thead>
                  <tr>
                    <th style="text-align: left; padding-left: 8px;">Indicador</th>
                    <th>{dados_p1['mes_anterior_label']}</th>
                    <th>{dados_p1['mes_atual_label']}</th>
                    <th>Var</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td style="text-align: left; padding-left: 8px;"><b>Intervenções</b></td>
                    <td>{_fmt_int(ant['intervencoes'])}</td>
                    <td><b>{_fmt_int(atual['intervencoes'])}</b></td>
                    <td style="color:{cls_var(-var['intervencoes_pct'])}; font-weight:bold;">{_fmt_pct(var['intervencoes_pct'])}</td>
                  </tr>
                  <tr>
                    <td style="text-align: left; padding-left: 8px;"><b>KM rodado</b></td>
                    <td>{_fmt_int(ant['km_total'])}</td>
                    <td><b>{_fmt_int(atual['km_total'])}</b></td>
                    <td style="color:{cls_var(var['km_pct'])}; font-weight:bold;">{_fmt_pct(var['km_pct'])}</td>
                  </tr>
                  <tr>
                    <td style="text-align: left; padding-left: 8px;"><b>MKBF</b></td>
                    <td>{_fmt_int(ant['mkbf'])}</td>
                    <td><b>{_fmt_int(atual['mkbf'])}</b></td>
                    <td style="color:{cls_var(var['mkbf_pct'])}; font-weight:bold;">{_fmt_pct(var['mkbf_pct'])}</td>
                  </tr>
                  <tr>
                    <td style="text-align: left; padding-left: 8px;"><b>Meta MKBF</b></td>
                    <td>{_fmt_int(MKBF_META)}</td>
                    <td>{_fmt_int(MKBF_META)}</td>
                    <td class="muted">-</td>
                  </tr>
                </tbody>
              </table>

              <div class="metric-wide">
                <div class="metric">
                  <div class="lbl">Aderência à meta</div>
                  <div class="val">{ader:.1f}%</div>
                  <div class="aux">Meta de referência: {_fmt_int(MKBF_META)}</div>
                </div>
                <div class="metric" style="text-align: center;">
                  <div class="lbl">Status do mês</div>
                  <div style="margin-top:10px;">
                    <span style="display:inline-block; padding:6px 10px; border-radius:10px; font-size:12px; font-weight:800; background:{status_bg_p1}; color:{status_fg_p1};">{status_text_p1}</span>
                  </div>
                  <div class="aux" style="margin-top:10px;">Base consolidada</div>
                </div>
              </div>
            </div>
          </div>

          <div class="card">
            <div class="card-title">Resumo executivo do período</div>
            <div class="card-body">
              <div class="metric-grid">
                <div class="metric">
                  <div class="lbl">Intervenções</div>
                  <div class="val">{_fmt_int(atual['intervencoes'])}</div>
                  <div class="aux">Ocorrências válidas</div>
                </div>
                <div class="metric">
                  <div class="lbl">KM rodado</div>
                  <div class="val">{_fmt_int(atual['km_total'])}</div>
                  <div class="aux">Acumulado total</div>
                </div>
                <div class="metric">
                  <div class="lbl">MKBF</div>
                  <div class="val">{_fmt_int(atual['mkbf'])}</div>
                  <div class="aux">KM ÷ intervenções</div>
                </div>
              </div>

              <div style="margin-top:12px;">
                <div class="badge">Meta MKBF: {_fmt_int(MKBF_META)}</div>
              </div>

              <div style="margin-top:14px;">
                <table>
                  <thead>
                    <tr>
                      <th style="text-align: left; padding-left: 8px;">Tipo de ocorrência</th>
                      <th>{dados_p1['mes_anterior_label']}</th>
                      <th>{dados_p1['mes_atual_label']}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows_motivos}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>

        <div class="card" style="margin-bottom:12px;">
          <div class="card-title">Evolução histórica do MKBF</div>
          <div class="card-body">
            <div class="chart-wrap">
              <img src="{img_path_1.name}" alt="Gráfico histórico do MKBF" />
            </div>
          </div>
        </div>

        <div class="cons-box">
          <div class="cons-title">Considerações executivas</div>
          <div class="cons-text">{cons_p1}</div>
        </div>

        <div class="footer">
          <div>Gerado automaticamente · Página 1/4</div>
          <div>{footer_right}</div>
        </div>
      </div>

      <div class="page-break"></div>

      <div class="page">
        <div class="header">
          <div class="title">
            <h1>FLASH REPORT MANUTENÇÃO</h1>
            <div class="sub">Página 2 · Intervenções por Dia e Projeções</div>
            <div class="sub">Período analisado: <b>{dados_p2['periodo_label']}</b></div>
          </div>
          <div class="period-box">
            <div class="ref">Mês de referência</div>
            <div class="val">{dados_p2['mes_atual_label']}</div>
          </div>
        </div>

        <div class="grid-top">
          <div class="card">
            <div class="card-title">Projeções e Metas</div>
            <div class="card-body">
              <table>
                <thead>
                  <tr>
                    <th style="text-align: left; padding-left: 8px;">Indicador</th>
                    <th>Valor Acumulado / Projeção</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td style="text-align: left; padding-left: 8px;"><b>Média de Intervenções / Dia</b></td>
                    <td style="font-weight: bold; font-size: 13px;">{dados_p2['media_interv_dia']:.1f}</td>
                  </tr>
                  <tr>
                    <td style="text-align: left; padding-left: 8px;"><b>Meta de Intervenções / Mês</b></td>
                    <td>{_fmt_int(dados_p2['meta_interv_mes'])}</td>
                  </tr>
                  <tr>
                    <td style="text-align: left; padding-left: 8px;"><b>Projeção Fim do Mês</b></td>
                    <td><b>{_fmt_int(dados_p2['proj_interv_mes'])}</b></td>
                  </tr>
                  <tr>
                    <td style="text-align: left; padding-left: 8px;"><b>Desvio (Delta vs Meta)</b></td>
                    <td style="color:{cor_delta}; font-weight:bold;">
                        {sinal_delta}{_fmt_int(dados_p2['delta_interv'])}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          <div class="card">
            <div class="card-title">Status e Base Analítica</div>
            <div class="card-body" style="display: flex; flex-direction: column; gap: 12px;">
              <div style="padding: 10px; background: #f8fafc; border: 1px dashed #cbd5e1; border-radius: 8px;">
                <div style="font-size: 11px; font-weight: bold; color: #334155; margin-bottom: 4px;">Informação de Base</div>
                <div style="font-size: 10px; color: #64748b; line-height: 1.4;">
                    Dias decorridos na análise: <b>{dados_p2['dias_decorridos']} dias</b>.<br/>
                    A meta de intervenções é calculada através do KM rodado dividido pela meta do MKBF ({_fmt_int(MKBF_META)}).
                </div>
              </div>
              
              <div style="padding: 10px; border: 1px solid #dbe3ee; border-radius: 8px; background: #fff; text-align: center;">
                 <div style="font-size:10px; color:#64748b; font-weight:bold; text-transform:uppercase; margin-bottom:8px;">Status da Projeção</div>
                 <div><span style="display:inline-block; padding:6px 10px; border-radius:10px; font-size:12px; font-weight:800; background:{status_bg_proj}; color:{status_fg_proj};">{status_proj}</span></div>
              </div>
            </div>
          </div>
        </div>

        <div class="card" style="margin-bottom:12px;">
          <div class="card-title">Evolução Diária - Intervenções e MKBF</div>
          <div class="card-body">
            <div class="chart-wrap">
              <img src="{img_path_2.name}" alt="Gráfico de Intervenções por Dia" />
            </div>
          </div>
        </div>

        <div class="cons-box">
          <div class="cons-title">Considerações executivas · Análise Diária</div>
          <div class="cons-text">{cons_p2}</div>
        </div>

        <div class="footer">
          <div>Gerado automaticamente · Página 2/4</div>
          <div>{footer_right}</div>
        </div>
      </div>

      <div class="page-break"></div>

      <div class="page">
        <div class="header">
          <div class="title">
            <h1>FLASH REPORT MANUTENÇÃO</h1>
            <div class="sub">Página 3 · Análise Estratégica (Linha / Horário / Carro / Cluster)</div>
            <div class="sub">Período consolidado: <b>{dados_p3['periodo_label']} (3 Meses)</b></div>
          </div>
          <div class="period-box">
            <div class="ref">Mês Referência Principal</div>
            <div class="val">{dados_p3['mes_ref_label']}</div>
          </div>
        </div>

        <div class="card" style="margin-bottom:12px;">
          <div class="card-title">Ocorrências por Linha e Horário</div>
          <div class="card-body" style="padding-bottom: 4px;">
            <img src="{img_p3_linha.name}" alt="Intervenções por linha" style="width: 100%; margin-bottom: 8px;">
            <hr style="border: 0; height: 1px; background: #dbe3ee; margin: 10px 0;">
            <img src="{img_p3_horario.name}" alt="Intervenções por horário" style="width: 100%;">
          </div>
        </div>

        <div class="grid-top-p3">
          <div class="card" style="height: 100%;">
            <div class="card-title">Top 10 - Veículos Ofensores</div>
            <div class="card-body" style="height: calc(100% - 35px); display: flex; align-items: center; justify-content: center;">
              <img src="{img_p3_top.name}" alt="Top 10 carro" style="width: 100%;">
            </div>
          </div>

          <div class="card" style="height: 100%;">
            <div class="card-title">Volume Histórico por Cluster</div>
            <div class="card-body">
              <table>
                <thead>
                  <tr>
                    <th style="text-align: left; padding-left: 8px;">Cluster</th>
                    <th>{lbl_m1}</th>
                    <th>{lbl_m2}</th>
                    <th style="color: #1e3a8a;">{lbl_m3} (Ref)</th>
                    <th>Int/Veículo<br/>(Mês Atual)</th>
                    <th>Frota<br/>(Mês Atual)</th>
                  </tr>
                </thead>
                <tbody>
                  {rows_cluster}
                </tbody>
              </table>
              <div style="margin-top: 12px; padding: 10px; text-align: right; background: #f8fafc; border-radius: 8px; font-size: 13px; font-weight: 800; color: #111827; border: 1px solid #dbe3ee;">
                TOTAL MÊS ATUAL <span style="color:#dc2626; margin-left: 15px; font-size: 16px;">{total_interv_cluster_ref}</span>
              </div>
            </div>
          </div>
        </div>

        <div class="cons-box">
          <div class="cons-title">Considerações executivas · Análise Estratégica</div>
          <div class="cons-text">{cons_p3}</div>
        </div>

        <div class="footer">
          <div>Gerado automaticamente · Página 3/4</div>
          <div>{footer_right}</div>
        </div>
      </div>
      
      <div class="page-break"></div>

      <div class="page">
        <div class="header">
          <div class="title">
            <h1>FLASH REPORT MANUTENÇÃO</h1>
            <div class="sub">Página 4 · Raio-X de Defeitos e Ofensores Detalhados</div>
            <div class="sub">Período analisado: <b>{dados_p4['periodo_label']} (3 Meses)</b></div>
          </div>
          <div class="period-box">
            <div class="ref">Mês Referência Principal</div>
            <div class="val">{dados_p4['meses_labels'][-1]}</div>
          </div>
        </div>
        
        <div class="metric-grid" style="grid-template-columns: repeat(4, 1fr); margin-bottom: 12px;">
            <div class="metric">
                <div class="lbl">Total 3 Meses</div>
                <div class="val">{_fmt_int(dados_p4['total_interv'])}</div>
            </div>
            <div class="metric">
                <div class="lbl">Principal Defeito (3M)</div>
                <div class="val" style="font-size:14px; white-space: normal;">{dados_p4['top_defeito']}</div>
            </div>
            <div class="metric">
                <div class="lbl">Principal Setor (3M)</div>
                <div class="val" style="font-size:14px; white-space: normal;">{dados_p4['top_setor']}</div>
            </div>
            <div class="metric">
                <div class="lbl">Pior Veículo (3M)</div>
                <div class="val" style="color: #dc2626;">{dados_p4['top_veiculo']}</div>
            </div>
        </div>
        
        <div class="card" style="margin-bottom:12px;">
            <div class="card-title">Top 5 Linhas Ofensoras e seus Principais Defeitos (Consolidado 3 Meses)</div>
            <div class="card-body">
                <table>
                    <thead>
                        <tr>
                            <th style="width: 25%; text-align: left; padding-left: 8px;">Linha</th>
                            <th style="width: 20%;">Total Intervenções</th>
                            <th style="width: 55%; text-align: left;">Maior Defeito Encontrado na Linha</th>
                        </tr>
                    </thead>
                    <tbody>
                        {rows_linhas_p4}
                    </tbody>
                </table>
            </div>
        </div>
        
        <div class="card" style="margin-bottom:12px;">
            <div class="card-title">Raio-X: Top 5 Veículos Ofensores Detalhados</div>
            <div class="card-body">
                <table style="font-size: 9px;">
                    <thead>
                        <tr>
                            <th style="width: 10%;">Veículo</th>
                            <th style="width: 8%;">Total<br/>(3M)</th>
                            <th style="width: 8%;">{dados_p4['meses_labels'][0]}</th>
                            <th style="width: 8%;">{dados_p4['meses_labels'][1]}</th>
                            <th style="width: 10%; color:#1e3a8a;">{dados_p4['meses_labels'][2]}<br/>(Ref)</th>
                            <th style="width: 12%;">Linha<br/>Principal</th>
                            <th style="width: 15%;">Setor<br/>Principal</th>
                            <th style="width: 29%; text-align:left;">Top 3 Defeitos Encontrados (Vol)</th>
                        </tr>
                    </thead>
                    <tbody>
                        {rows_carros_p4}
                    </tbody>
                </table>
            </div>
        </div>

        <div class="cons-box">
          <div class="cons-title">Considerações executivas · Raio-X de Defeitos</div>
          <div class="cons-text">{cons_p4}</div>
        </div>

        <div class="footer">
          <div>Gerado automaticamente · Página 4/4</div>
          <div>{footer_right}</div>
        </div>
      </div>
    </body>
    </html>
    """
    html_path.write_text(html, encoding="utf-8")
    print(f"✅ HTML completo salvo: {html_path}")


def _num_br(v, casas=1):
    try:
        s = f"{float(v):,.{casas}f}"
        return s.replace(",", "X").replace(".", ",").replace("X", ".")
    except Exception:
        return "0"


TEMPLATES_DIR = Path(__file__).resolve().parent / "flash_templates"


def gerar_html_consolidado_teal(
    dados_p1: dict, dados_p2: dict, dados_p3: dict, dados_p4: dict,
    dados_regen: dict, dados_borracharia: dict, dados_gns: dict,
    dados_embarcados: dict, dados_motoristas: dict, dados_sr: dict,
    dados_prev: dict, df_acuracidade_mensal: pd.DataFrame, dados_oport: dict,
    img: dict, html_path: Path,
):
    theme_css = (TEMPLATES_DIR / "theme_teal.css").read_text(encoding="utf-8")

    periodo_fim = dados_p1["periodo_fim"]
    mes_ref_label = dados_p1["mes_atual_label"].upper()
    footer_right = f"Relatório ID: {REPORT_ID}" if REPORT_ID else "Flash Report Manutenção — Quatai"

    def img_tag(key, alt=""):
        return f'<img src="{img[key].name}" alt="{alt}" />' if key in img else ""

    def img_tag_h(key, max_h_px, alt=""):
        # imagem com altura máxima fixa (evita overflow vertical da página)
        return (f'<img src="{img[key].name}" alt="{alt}" '
                f'style="width:100%;max-height:{max_h_px}px;height:auto;display:block;margin:0 auto;object-fit:contain;" />'
                if key in img else "")

    # ===================== CAPA =====================
    mkbf_capa = _num_br(dados_p1["resumo_atual"]["mkbf"], 0)
    ader_prev_capa = _num_br(dados_prev.get("acuracidade_pct", 0.0), 1)
    gns_capa = _num_br(dados_gns.get("gns_medio", 0.0), 1)
    interv_capa = _fmt_int(dados_p1["resumo_atual"]["intervencoes"])
    capa = f"""
<div class="page" style="background:linear-gradient(160deg,#0a2b28 0%,#0f3d38 55%,#0d5750 100%); color:#fff; display:flex; flex-direction:column; align-items:center; justify-content:center; text-align:center;">
  <svg viewBox="0 0 130 60" width="140" style="margin-bottom:16px;" xmlns="http://www.w3.org/2000/svg">
    <g fill="none" stroke="#5eead4" stroke-width="3.5" stroke-linecap="round">
      <circle cx="38" cy="30" r="16"></circle>
      <path d="M38 11 v6 M38 43 v6 M19 30 h6 M51 30 h6 M25 17 l4 4 M47 39 l4 4 M25 43 l4 -4 M47 21 l4 -4"></path>
      <circle cx="38" cy="30" r="6" fill="#5eead4" stroke="none"></circle>
      <rect x="72" y="18" width="46" height="24" rx="5"></rect>
      <path d="M80 42 v6 M110 42 v6"></path>
    </g>
  </svg>
  <div style="font-size:14px; font-weight:800; letter-spacing:3px; color:#5eead4;">GRUPO CSC · QUATAI</div>
  <div style="font-size:50px; font-weight:900; letter-spacing:1px; margin-top:12px; line-height:1;">MANUTENÇÃO</div>
  <div style="font-size:23px; font-weight:800; letter-spacing:2px; color:#2dd4bf; margin-top:6px;">FLASH REPORT MENSAL</div>
  <div style="margin-top:18px; border:2px solid #2dd4bf; border-radius:10px; padding:8px 26px; font-size:15px; font-weight:800; letter-spacing:2px;">{mes_ref_label}</div>
  <div style="display:flex; gap:46px; margin-top:34px;">
    <div><div style="font-size:10px; letter-spacing:1px; color:#9fe6dc;">MKBF</div><div style="font-size:24px; font-weight:900; margin-top:3px;">{mkbf_capa}</div></div>
    <div><div style="font-size:10px; letter-spacing:1px; color:#9fe6dc;">ADERÊNCIA PREV.</div><div style="font-size:24px; font-weight:900; margin-top:3px;">{ader_prev_capa}%</div></div>
    <div><div style="font-size:10px; letter-spacing:1px; color:#9fe6dc;">GNS MÉDIO</div><div style="font-size:24px; font-weight:900; margin-top:3px;">{gns_capa}</div></div>
    <div><div style="font-size:10px; letter-spacing:1px; color:#9fe6dc;">INTERVENÇÕES</div><div style="font-size:24px; font-weight:900; margin-top:3px;">{interv_capa}</div></div>
  </div>
  <div style="position:absolute; bottom:12mm; font-size:9px; color:#7fd4c8; letter-spacing:1px;">GERADO AUTOMATICAMENTE · DADOS REAIS CONSOLIDADOS · {dados_p1['periodo_label'].upper()}</div>
</div>
"""

    # ===================== ÍNDICE =====================
    itens_indice = [
        "Intervenções — Mês / MKBF", "Intervenções — Dia e Projeções",
        "Análise por Linha, Horário e Cluster", "Raio-X de Defeitos e Ofensores",
        "Regeneração do DPF", "Borracharia — Pneus", "Intervenções por Motorista",
        "Solicitação de Reparo — Aderência", "Solicitação de Reparo por Grupo",
        "Controle de Preventivas", "GNS — Carros Parados",
        "Embarcados — Câmeras e Vision", "Oportunidades de Melhoria",
    ]
    rows_indice = "".join(
        f'<tr><td style="width:40px;text-align:center;font-weight:900;color:#0d9488;">{i+1:02d}</td>'
        f'<td style="text-align:left;padding-left:12px;">{t}</td></tr>'
        for i, t in enumerate(itens_indice)
    )
    indice = f"""
<div class="page">
  <div class="header">
    <div class="title"><h1>ÍNDICE DO RELATÓRIO</h1><div class="sub">Manutenção · Flash Report Mensal</div></div>
    <div class="period-box"><div class="ref">Mês</div><div class="val">{mes_ref_label}</div></div>
  </div>
  <div class="accent-bar"></div>
  <div class="card"><div class="card-title">Conteúdo</div><div class="card-body">
    <table style="font-size:13px;"><tbody>{rows_indice}</tbody></table>
  </div></div>
  <div class="footer"><div>Gerado automaticamente · dados reais consolidados</div><div>Flash Report Manutenção — Quatai</div></div>
</div>
"""

    def header_block(titulo_pagina: str, sub2: str, ref_label: str, ref_val: str) -> str:
        return f"""
  <div class="header">
    <div class="title">
      <h1>{titulo_pagina}</h1>
      <div class="sub">{sub2}</div>
    </div>
    <div class="period-box">
      <div class="ref">{ref_label}</div>
      <div class="val">{ref_val}</div>
    </div>
  </div>
  <div class="accent-bar"></div>
"""

    def footer_block(n: int) -> str:
        return f'<div class="footer"><div>Gerado automaticamente · Página {n}/15 · dados reais</div><div>{footer_right}</div></div>'

    paginas = []

    # ===================== P1 · MKBF =====================
    atual = dados_p1["resumo_atual"]; ant = dados_p1["resumo_ant"]
    var = dados_p1["variacoes"]; ader = dados_p1["aderencia_meta_pct"]
    motivos = dados_p1["df_motivos"].copy()
    cons_p1 = gerar_consideracoes_ia_p1(dados_p1)
    status_text_p1 = "ATINGIU" if atual["mkbf"] >= MKBF_META else "ABAIXO"
    status_bg_p1 = "#dcfce7" if atual["mkbf"] >= MKBF_META else "#fee2e2"
    status_fg_p1 = "#166534" if atual["mkbf"] >= MKBF_META else "#991b1b"
    rows_motivos = "".join(
        f'<tr><td style="text-align:left;padding-left:8px;">{r["tipo"]}</td>'
        f'<td>{_fmt_int(r["mes_anterior"])}</td><td style="font-weight:700;">{_fmt_int(r["mes_atual"])}</td></tr>'
        for _, r in motivos.iterrows()
    )
    paginas.append(f"""
<div class="page">
{header_block("INTERVENÇÕES DO MÊS / MKBF", f"Página 1 · Intervenções do mês / MKBF · Período: <b>{dados_p1['periodo_label']}</b>", "Mês de referência", mes_ref_label)}
  <div class="grid-top">
    <div class="card">
      <div class="card-title">Comparativo mensal</div>
      <div class="card-body">
        <table>
          <thead><tr><th style="text-align:left;padding-left:8px;">Indicador</th><th>{dados_p1['mes_anterior_label']}</th><th>{dados_p1['mes_atual_label']}</th><th>Var</th></tr></thead>
          <tbody>
            <tr><td style="text-align:left;padding-left:8px;"><b>Intervenções</b></td><td>{_fmt_int(ant['intervencoes'])}</td><td><b>{_fmt_int(atual['intervencoes'])}</b></td><td style="color:{cls_var(-var['intervencoes_pct'])};font-weight:bold;">{_fmt_pct(var['intervencoes_pct'])}</td></tr>
            <tr><td style="text-align:left;padding-left:8px;"><b>KM rodado</b></td><td>{_fmt_int(ant['km_total'])}</td><td><b>{_fmt_int(atual['km_total'])}</b></td><td style="color:{cls_var(var['km_pct'])};font-weight:bold;">{_fmt_pct(var['km_pct'])}</td></tr>
            <tr><td style="text-align:left;padding-left:8px;"><b>MKBF</b></td><td>{_fmt_int(ant['mkbf'])}</td><td><b>{_fmt_int(atual['mkbf'])}</b></td><td style="color:{cls_var(var['mkbf_pct'])};font-weight:bold;">{_fmt_pct(var['mkbf_pct'])}</td></tr>
            <tr><td style="text-align:left;padding-left:8px;"><b>Meta MKBF</b></td><td>{_fmt_int(MKBF_META)}</td><td>{_fmt_int(MKBF_META)}</td><td class="muted">-</td></tr>
          </tbody>
        </table>
        <div class="metric-wide">
          <div class="metric"><div class="lbl">Aderência à meta</div><div class="val">{ader:.1f}%</div><div class="aux">Meta de referência: {_fmt_int(MKBF_META)}</div></div>
          <div class="metric" style="text-align:center;"><div class="lbl">Status do mês</div><div style="margin-top:10px;"><span class="pill" style="font-size:12px;padding:6px 10px;background:{status_bg_p1};color:{status_fg_p1};">{status_text_p1}</span></div></div>
        </div>
      </div>
    </div>
    <div class="card">
      <div class="card-title">Resumo executivo do período</div>
      <div class="card-body">
        <div class="metric-grid">
          <div class="metric"><div class="lbl">Intervenções</div><div class="val">{_fmt_int(atual['intervencoes'])}</div><div class="aux">Ocorrências válidas</div></div>
          <div class="metric"><div class="lbl">KM rodado</div><div class="val">{_fmt_int(atual['km_total'])}</div><div class="aux">Acumulado total</div></div>
          <div class="metric"><div class="lbl">MKBF</div><div class="val">{_fmt_int(atual['mkbf'])}</div><div class="aux">KM ÷ intervenções</div></div>
        </div>
        <div style="margin-top:12px;"><div class="badge">Meta MKBF: {_fmt_int(MKBF_META)}</div></div>
        <div style="margin-top:14px;">
          <table><thead><tr><th style="text-align:left;padding-left:8px;">Tipo de ocorrência</th><th>{dados_p1['mes_anterior_label']}</th><th>{dados_p1['mes_atual_label']}</th></tr></thead><tbody>{rows_motivos}</tbody></table>
        </div>
      </div>
    </div>
  </div>
  <div class="card"><div class="card-title">Evolução histórica do MKBF</div><div class="card-body"><div class="chart-wrap">{img_tag('mkbf_hist')}</div></div></div>
  <div class="cons-box"><div class="cons-title">Considerações executivas</div><div class="cons-text">{cons_p1}</div></div>
{footer_block(1)}
</div>
""")

    # ===================== P2 · Intervenções por Dia =====================
    cons_p2 = gerar_consideracoes_ia_p2(dados_p2)
    status_proj = "ALERTA" if dados_p2["proj_interv_mes"] > dados_p2["meta_interv_mes"] else "DENTRO DO ESPERADO"
    status_bg_proj = "#fee2e2" if dados_p2["proj_interv_mes"] > dados_p2["meta_interv_mes"] else "#dcfce7"
    status_fg_proj = "#991b1b" if dados_p2["proj_interv_mes"] > dados_p2["meta_interv_mes"] else "#166534"
    cor_delta = RED if dados_p2["delta_interv"] > 0 else "#16a34a"
    sinal_delta = "+" if dados_p2["delta_interv"] > 0 else ""
    paginas.append(f"""
<div class="page">
{header_block("INTERVENÇÕES POR DIA E PROJEÇÕES", f"Página 2 · Intervenções por Dia e Projeções · Período: <b>{dados_p2['periodo_label']}</b>", "Mês de referência", mes_ref_label)}
  <div class="grid-top">
    <div class="card">
      <div class="card-title">Projeções e Metas</div>
      <div class="card-body">
        <table>
          <thead><tr><th style="text-align:left;padding-left:8px;">Indicador</th><th>Valor Acumulado / Projeção</th></tr></thead>
          <tbody>
            <tr><td style="text-align:left;padding-left:8px;"><b>Média de Intervenções / Dia</b></td><td style="font-weight:bold;font-size:13px;">{_num_br(dados_p2['media_interv_dia'],1)}</td></tr>
            <tr><td style="text-align:left;padding-left:8px;"><b>Meta de Intervenções / Mês</b></td><td>{_fmt_int(dados_p2['meta_interv_mes'])}</td></tr>
            <tr><td style="text-align:left;padding-left:8px;"><b>Projeção Fim do Mês</b></td><td><b>{_fmt_int(dados_p2['proj_interv_mes'])}</b></td></tr>
            <tr><td style="text-align:left;padding-left:8px;"><b>Desvio (Delta vs Meta)</b></td><td style="color:{cor_delta};font-weight:bold;">{sinal_delta}{_fmt_int(dados_p2['delta_interv'])}</td></tr>
          </tbody>
        </table>
      </div>
    </div>
    <div class="card">
      <div class="card-title">Status e Base Analítica</div>
      <div class="card-body" style="display:flex;flex-direction:column;gap:12px;">
        <div style="padding:10px;background:#f6faf9;border:1px dashed #d6e3e0;border-radius:8px;">
          <div style="font-size:11px;font-weight:bold;color:#123b35;margin-bottom:4px;">Informação de Base</div>
          <div style="font-size:10px;color:#5b716c;line-height:1.4;">Dias decorridos na análise: <b>{dados_p2['dias_decorridos']} dias</b>.<br/>A meta de intervenções é calculada através do KM rodado dividido pela meta do MKBF ({_fmt_int(MKBF_META)}).</div>
        </div>
        <div style="padding:10px;border:1px solid #d6e3e0;border-radius:8px;background:#fff;text-align:center;">
          <div style="font-size:10px;color:#5b716c;font-weight:bold;text-transform:uppercase;margin-bottom:8px;">Status da Projeção</div>
          <div><span class="pill" style="font-size:12px;padding:6px 10px;background:{status_bg_proj};color:{status_fg_proj};">{status_proj}</span></div>
        </div>
      </div>
    </div>
  </div>
  <div class="card"><div class="card-title">Evolução Diária - Intervenções e MKBF</div><div class="card-body"><div class="chart-wrap">{img_tag('p2_diario')}</div></div></div>
  <div class="cons-box"><div class="cons-title">Considerações executivas · Análise Diária</div><div class="cons-text">{cons_p2}</div></div>
{footer_block(2)}
</div>
""")

    # ===================== P3 · Análise Estratégica =====================
    df_cluster = dados_p3["df_cluster"].copy()
    cons_p3 = gerar_consideracoes_ia_p3(dados_p3)
    lbl_m1, lbl_m2, lbl_m3 = dados_p3['meses_labels']
    rows_cluster = "".join(
        f'<tr><td style="font-weight:bold;text-align:left;padding-left:8px;">{r["cluster"]}</td>'
        f'<td>{int(r[lbl_m1])}</td><td>{int(r[lbl_m2])}</td>'
        f'<td style="font-weight:700;color:#0d9488;">{int(r[lbl_m3])}</td>'
        f'<td>{_num_br(r["int_veiculo_ref"],2)}</td><td>{int(r["frota_ref"])}</td></tr>'
        for _, r in df_cluster.iterrows()
    )
    total_interv_cluster_ref = _fmt_int(df_cluster[lbl_m3].sum()) if not df_cluster.empty else "0"
    paginas.append(f"""
<div class="page">
{header_block("ANÁLISE ESTRATÉGICA (LINHA / HORÁRIO / CARRO / CLUSTER)", f"Página 3 · Análise Estratégica · Período: <b>{dados_p3['periodo_label']} (3 meses)</b>", "Mês Referência", dados_p3['mes_ref_label'])}
  <div class="card" style="margin-bottom:12px;">
    <div class="card-title">Ocorrências por Linha e Horário</div>
    <div class="card-body" style="padding-bottom:4px;">
      {img_tag_h('p3_linha', 132)}
      <hr style="border:0;height:1px;background:#d6e3e0;margin:8px 0;">
      {img_tag_h('p3_horario', 118)}
    </div>
  </div>
  <div class="grid-top-p3">
    <div class="card" style="height:100%;">
      <div class="card-title">Top 10 - Veículos Ofensores</div>
      <div class="card-body" style="display:flex;align-items:center;justify-content:center;">{img_tag_h('p3_top', 168)}</div>
    </div>
    <div class="card" style="height:100%;">
      <div class="card-title">Volume Histórico por Cluster</div>
      <div class="card-body">
        <table>
          <thead><tr><th style="text-align:left;padding-left:8px;">Cluster</th><th>{lbl_m1}</th><th>{lbl_m2}</th><th style="color:#0d9488;">{lbl_m3} (Ref)</th><th>Int/Veículo<br/>(Mês Atual)</th><th>Frota<br/>(Mês Atual)</th></tr></thead>
          <tbody>{rows_cluster}</tbody>
        </table>
        <div style="margin-top:12px;padding:10px;text-align:right;background:#f6faf9;border-radius:8px;font-size:13px;font-weight:800;color:#123b35;border:1px solid #d6e3e0;">
          TOTAL MÊS ATUAL <span style="color:#dc2626;margin-left:15px;font-size:16px;">{total_interv_cluster_ref}</span>
        </div>
      </div>
    </div>
  </div>
  <div class="cons-box"><div class="cons-title">Considerações executivas · Análise Estratégica</div><div class="cons-text">{cons_p3}</div></div>
{footer_block(3)}
</div>
""")

    # ===================== P4 · Raio-X de Defeitos =====================
    cons_p4 = gerar_consideracoes_ia_p4(dados_p4)
    rows_linhas_p4 = "".join(
        f'<tr><td style="font-weight:bold;text-align:left;padding-left:8px;">{l["linha"]}</td>'
        f'<td style="font-weight:bold;color:#dc2626;">{l["total"]}</td><td style="text-align:left;">{l["maior_defeito"]}</td></tr>'
        for l in dados_p4["top_5_linhas"]
    )
    rows_carros_p4 = "".join(
        f'<tr><td style="font-weight:bold;color:#0d9488;">{c["veiculo"]}</td><td style="font-weight:bold;">{c["total"]}</td>'
        f'<td>{c["m1"]}</td><td>{c["m2"]}</td><td style="font-weight:bold;color:#dc2626;">{c["m3"]}</td>'
        f'<td>{c["linha_principal"]}</td><td>{c["setor_principal"]}</td>'
        f'<td style="text-align:left;font-size:8px;">{c["top_defeitos"]}</td></tr>'
        for c in dados_p4["top_5_carros"]
    )
    mref4 = dados_p4["meses_labels"][-1] if dados_p4.get("meses_labels") else mes_ref_label
    paginas.append(f"""
<div class="page">
{header_block("ANÁLISE DE DEFEITOS E COMPONENTES", f"Página 4 · Raio-X de Defeitos e Ofensores Detalhados · Período: <b>{dados_p4['periodo_label']} (3 meses)</b>", "Mês Referência", mref4)}
  <div class="metric-grid" style="grid-template-columns:repeat(4,1fr);margin-bottom:12px;">
    <div class="metric"><div class="lbl">Total 3 Meses</div><div class="val">{_fmt_int(dados_p4['total_interv'])}</div></div>
    <div class="metric"><div class="lbl">Principal Defeito (3M)</div><div class="val" style="font-size:14px;white-space:normal;">{dados_p4['top_defeito']}</div></div>
    <div class="metric"><div class="lbl">Principal Setor (3M)</div><div class="val" style="font-size:14px;white-space:normal;">{dados_p4['top_setor']}</div></div>
    <div class="metric"><div class="lbl">Pior Veículo (3M)</div><div class="val" style="color:#dc2626;">{dados_p4['top_veiculo']}</div></div>
  </div>
  <div class="card"><div class="card-title">Top 5 Linhas Ofensoras e seus Principais Defeitos (Consolidado 3 Meses)</div>
    <div class="card-body"><table><thead><tr><th style="width:25%;text-align:left;padding-left:8px;">Linha</th><th style="width:20%;">Total Intervenções</th><th style="width:55%;text-align:left;">Maior Defeito Encontrado na Linha</th></tr></thead><tbody>{rows_linhas_p4}</tbody></table></div>
  </div>
  <div class="card"><div class="card-title">Raio-X: Top 5 Veículos Ofensores Detalhados</div>
    <div class="card-body"><table style="font-size:9px;"><thead><tr><th>Veículo</th><th>Total<br/>(3M)</th><th>{dados_p4['meses_labels'][0]}</th><th>{dados_p4['meses_labels'][1]}</th><th style="color:#0d9488;">{dados_p4['meses_labels'][2]}<br/>(Ref)</th><th>Linha<br/>Principal</th><th>Setor<br/>Principal</th><th style="text-align:left;">Top 3 Defeitos Encontrados (Vol)</th></tr></thead><tbody>{rows_carros_p4}</tbody></table></div>
  </div>
  <div class="cons-box"><div class="cons-title">Considerações executivas · Raio-X de Defeitos</div><div class="cons-text">{cons_p4}</div></div>
{footer_block(4)}
</div>
""")

    # ===================== P5 · Regeneração do DPF =====================
    top_v = dados_regen.get("top_veiculos", pd.DataFrame())
    pior_veic = top_v.iloc[0]["prefixo"] if not top_v.empty else "N/D"
    pior_veic_eventos = int(top_v.iloc[0]["eventos"]) if not top_v.empty else 0
    rows_regen = "".join(
        f'<tr><td style="font-weight:700;">{r["prefixo"]}</td><td style="font-weight:700;">{int(r["eventos"])}</td>'
        f'<td>{_fmt_int(r["custo"])}</td><td>{_num_br(r["dur_media"],0)} min</td></tr>'
        for _, r in top_v.head(10).iterrows()
    )
    cons_regen = (
        f"Em {dados_p1['mes_atual_label'].lower()}, a operação registrou {dados_regen['eventos']} eventos de "
        f"regeneração do DPF, com custo de R$ {_fmt_int(dados_regen['custo_total'])} em diesel queimado "
        f"({_fmt_int(dados_regen['consumo_litros'] if 'consumo_litros' in dados_regen else dados_regen.get('consumo_total',0))} litros) "
        f"e duração média de {_num_br(dados_regen['duracao_media'],0)} minutos por evento, em {dados_regen['veiculos']} veículos distintos. "
        f"O veículo {pior_veic} concentrou o maior volume, com {pior_veic_eventos} regenerações no período. "
        f"Esses litros entram no consumo da frota sem gerar KM útil: representam "
        f"{_num_br(dados_regen.get('litros_regen_pct',0),2)}% do diesel do mês e puxam o KM/L da empresa de "
        f"{_num_br(dados_regen.get('kml_sem_regen',0),3)} para {_num_br(dados_regen.get('kml_com_regen',0),3)} "
        f"(−{_num_br(dados_regen.get('kml_impacto',0),3)} km/L, {_num_br(dados_regen.get('kml_impacto_pct',0),2)}%). "
        f"O peso no indicador é pequeno — o custo da regeneração é o alerta de falha, não o consumo em si. "
        f"A regeneração frequente é um sinal precoce de quebra — recomenda-se inspeção do sistema de escape/DPF "
        f"nos veículos com maior recorrência antes que o problema evolua para uma SOS em rua."
    )
    paginas.append(f"""
<div class="page">
{header_block("REGENERAÇÃO DO DPF", f"Regeneração do DPF · Fonte: eventos_regeneracao (consumo e custo de diesel na queima do filtro)", "Mês", mes_ref_label)}
  <div class="grid" style="grid-template-columns:repeat(5,1fr);margin-bottom:12px;">
    <div class="metric" style="border-left:4px solid #0d9488;"><div class="lbl">Eventos</div><div class="val" style="color:#0d9488;">{_fmt_int(dados_regen['eventos'])}</div><div class="aux">{dados_regen['veiculos']} veículos</div></div>
    <div class="metric" style="border-left:4px solid #dc2626;"><div class="lbl">Custo Diesel</div><div class="val" style="color:#dc2626;">R$ {_fmt_int(dados_regen['custo_total'])}</div><div class="aux">{_fmt_int(dados_regen.get('consumo_total',0))} litros</div></div>
    <div class="metric"><div class="lbl">Duração Média</div><div class="val">{_num_br(dados_regen['duracao_media'],0)} min</div><div class="aux">por regeneração</div></div>
    <div class="metric" style="border-left:4px solid #f59e0b;"><div class="lbl">Pior Veículo</div><div class="val" style="font-size:15px;">{pior_veic}</div><div class="aux">{pior_veic_eventos} regenerações</div></div>
    <div class="metric" style="border-left:4px solid #64748b;"><div class="lbl">Impacto no KM/L</div><div class="val" style="color:#64748b;font-size:17px;">−{_num_br(dados_regen.get('kml_impacto',0),3)}</div><div class="aux">{_num_br(dados_regen.get('kml_com_regen',0),3)} → {_num_br(dados_regen.get('kml_sem_regen',0),3)} sem regen ({_num_br(dados_regen.get('kml_impacto_pct',0),2)}%)</div></div>
  </div>
  <div class="grid" style="grid-template-columns:1fr 1.1fr;">
    <div class="card" style="margin-bottom:0;">
      <div class="card-title">Top 10 Veículos — Regenerações</div>
      <div class="card-body"><table><thead><tr><th>Veículo</th><th>Eventos</th><th>Custo R$</th><th>Duração méd.</th></tr></thead><tbody>{rows_regen}</tbody></table></div>
    </div>
    <div class="card" style="margin-bottom:0;">
      <div class="card-title">Custo de Regeneração por Mês</div>
      <div class="card-body"><div class="chart-wrap">{img_tag('regen')}</div></div>
    </div>
  </div>
  <div class="cons-box"><div class="cons-title">Considerações · Regeneração</div><div class="cons-text">{cons_regen}</div></div>
{footer_block(5)}
</div>
""")

    # ===================== P6 · Borracharia =====================
    b = dados_borracharia
    if b.get('estoque_fisico') is not None:
        estoque_val = _fmt_int(b['estoque_fisico'])
        estoque_lbl = "Estoque Físico"
        estoque_aux = f"{_fmt_int(b['estoque_transnet'])} no TransNet"
    else:
        estoque_val = _fmt_int(b['estoque_transnet'])
        estoque_lbl = "Estoque"
        estoque_aux = "No TransNet"
    rows_novos = "".join(
        f'<tr><td style="font-weight:700;">{r["mescad"]}</td><td>{int(r["qtd"])}</td>'
        f'<td style="font-weight:700;color:#0d9488;">{_fmt_int(r["km_med"])}</td><td>{_fmt_int(r["km_max"])}</td></tr>'
        for _, r in b["df_pneus_novos"].iterrows()
    )
    rows_diverg = "".join(
        f'<tr><td style="font-weight:700;">{r["numero_fogo_base"]}</td><td style="font-weight:700;">{r["prefixo_base"]}</td>'
        f'<td>{r["posicao"]}</td><td style="color:#991b1b;font-weight:700;">{r["status"]}</td></tr>'
        for _, r in b["df_divergentes"].head(10).iterrows()
    ) if not b["df_divergentes"].empty else '<tr><td colspan="4" class="muted">Sem divergências no período</td></tr>'
    cons_borr = (
        f"No mês, foram registradas {_fmt_int(b['trocas_mes'])} trocas de pneu ({_fmt_int(b['trocas_trimestre'])} no trimestre), "
        f"com estoque de {_fmt_int(b['estoque_transnet'])} pneus no TransNet ({_fmt_int(b['novos_estoque'])} novos e "
        f"{_fmt_int(b['recap_estoque'])} recapados). O controle central de posições apresenta {b['corretos_pct']:.1f}% de "
        f"acuracidade ({_fmt_int(b['corretos_ok'])} de {_fmt_int(b['corretos_total'])} posições), com {_fmt_int(b['divergentes'])} "
        f"divergências entre o físico e o TransNet a corrigir. O teste de KM dos pneus novos ({_fmt_int(b['pneus_novos_total'])} "
        f"unidades cadastradas no ano) segue formando a base histórica de vida útil por coorte de fabricação."
    )
    paginas.append(f"""
<div class="page">
{header_block("BORRACHARIA · PNEUS", "Borracharia · Pneus · Fonte: TransNet (pcm_pneus_transnet_ativos) · trocas (pcm_troca_pneus)", "Mês", mes_ref_label)}
  <div class="grid" style="grid-template-columns:repeat(4,1fr);margin-bottom:12px;">
    <div class="metric" style="border-left:4px solid #0d9488;"><div class="lbl">Trocas (Mês)</div><div class="val" style="color:#0d9488;">{_fmt_int(b['trocas_mes'])}</div><div class="aux">{_fmt_int(b['trocas_trimestre'])} no trimestre</div></div>
    <div class="metric"><div class="lbl">{estoque_lbl}</div><div class="val">{estoque_val}</div><div class="aux">{estoque_aux}</div></div>
    <div class="metric" style="border-left:4px solid #16a34a;"><div class="lbl">Corretos no Sistema</div><div class="val" style="color:#166534;">{b['corretos_pct']:.0f}%</div><div class="aux">{_fmt_int(b['corretos_ok'])} de {_fmt_int(b['corretos_total'])} posições</div></div>
    <div class="metric" style="border-left:4px solid #dc2626;"><div class="lbl">Divergentes</div><div class="val" style="color:#dc2626;">{_fmt_int(b['divergentes'])}</div><div class="aux">físico ≠ TransNet</div></div>
  </div>
  <div class="card">
    <div class="card-title">Teste · KM Rodado dos Pneus Novos (por mês de cadastro)</div>
    <div class="card-body"><table><thead><tr><th>Mês cadastro (fogo)</th><th>Qtd pneus</th><th>KM médio</th><th>KM máx</th></tr></thead><tbody>{rows_novos or '<tr><td colspan="4" class="muted">Sem coorte no ano</td></tr>'}</tbody></table></div>
  </div>
  <div class="grid" style="grid-template-columns:1fr 1fr;">
    <div class="card" style="margin-bottom:0;"><div class="card-title">Trocas de Pneu por Mês</div><div class="card-body">{img_tag('borracharia')}</div></div>
    <div class="card" style="margin-bottom:0;"><div class="card-title">Pneus Divergentes · Físico ≠ TransNet</div><div class="card-body"><table style="font-size:9px;"><thead><tr><th>Fogo</th><th>Veículo</th><th>Posição</th><th>Status</th></tr></thead><tbody>{rows_diverg}</tbody></table></div></div>
  </div>
  <div class="cons-box"><div class="cons-title">Considerações · Borracharia</div><div class="cons-text">{cons_borr}</div></div>
{footer_block(6)}
</div>
""")

    # ===================== P7 · Motoristas =====================
    m = dados_motoristas
    rows_proc = "".join(
        f'<tr><td style="text-align:left;padding-left:8px;font-weight:700;">{r["motorista_nome"]}</td><td style="font-weight:700;color:#0d9488;">{int(r["qtd"])}</td></tr>'
        for _, r in m["top_procedentes"].iterrows()
    ) or '<tr><td colspan="2" class="muted">Sem dados no período</td></tr>'
    rows_impro = "".join(
        f'<tr><td style="text-align:left;padding-left:8px;font-weight:700;">{r["motorista_nome"]}</td><td style="font-weight:700;color:#b45309;">{int(r["qtd"])}</td></tr>'
        for _, r in m["top_improcedentes"].iterrows()
    ) or '<tr><td colspan="2" class="muted">Sem dados no ano</td></tr>'
    cons_mot = (
        f"Em {dados_p1['mes_atual_label'].lower()}, o motorista com maior volume de intervenções procedentes foi "
        f"{(m['top_procedentes'].iloc[0]['motorista_nome'] if not m['top_procedentes'].empty else 'N/D')}. "
        f"No acumulado de {periodo_fim.year}, foram {_fmt_int(m['total_improcedentes_ano'])} acionamentos improcedentes, "
        f"concentrados principalmente em "
        f"{(m['top_improcedentes'].iloc[0]['motorista_nome'] if not m['top_improcedentes'].empty else 'nenhum motorista específico')}. "
        f"Improcedentes recorrentes indicam necessidade de reciclagem no uso correto do acionamento de socorro."
    )
    paginas.append(f"""
<div class="page">
{header_block("INTERVENÇÕES POR MOTORISTA", f"Procedentes: {dados_p1['mes_atual_label']} · Improcedentes: {periodo_fim.year}", "Mês de referência", mes_ref_label)}
  <div class="grid" style="grid-template-columns:1fr 1fr;">
    <div class="card" style="margin-bottom:0;"><div class="card-title">Top 5 Motoristas — Procedentes</div><div class="card-body"><table><thead><tr><th style="text-align:left;padding-left:8px;">Motorista</th><th>Intervenções</th></tr></thead><tbody>{rows_proc}</tbody></table></div></div>
    <div class="card" style="margin-bottom:0;"><div class="card-title">Top Motoristas — Improcedentes ({periodo_fim.year})</div><div class="card-body"><table><thead><tr><th style="text-align:left;padding-left:8px;">Motorista</th><th>Improcedentes</th></tr></thead><tbody>{rows_impro}</tbody></table></div></div>
  </div>
  <div class="card"><div class="card-title">Improcedentes por Mês — {periodo_fim.year}</div><div class="card-body"><div class="chart-wrap">{img_tag('motoristas')}</div></div></div>
  <div class="cons-box"><div class="cons-title">Considerações · Motoristas</div><div class="cons-text">{cons_mot}</div></div>
{footer_block(7)}
</div>
""")

    # ===================== P8 · Solicitação de Reparo (competência) =====================
    sr = dados_sr
    sit_a = sr["situacao_atual"]; sit_ant = sr["situacao_anterior"]
    meta_sr = sr["meta_competencia"]
    comp_atual = sr["competencia_mensal"][-1]["pct"] if sr["competencia_mensal"] else 0.0
    comp_ant = sr["competencia_mensal"][-2]["pct"] if len(sr["competencia_mensal"]) > 1 else 0.0
    gap = comp_ant - meta_sr
    buckets_lbl = ["1-5", "6-10", "11-15", "16-20", "21-59", ">60"]
    cons_sr = (
        f"No período, {_fmt_int(sit_a['total'])} solicitações de reparo foram abertas, das quais "
        f"{sit_a['A']} atendidas, {sit_a['I']} improcedentes e {sit_a['N']} ainda não atendidas. "
        f"A aderência por competência do mês fechado mais recente ficou em {comp_ant:.1f}% frente à meta de "
        f"{_fmt_int(meta_sr)}%, uma diferença de {gap:+.1f} pontos. Hoje há {_fmt_int(sr['aberto_total'])} "
        f"SRs em aberto, sendo a mais antiga com {_fmt_int(sr['mais_antiga_dias'])} dias — reforça a necessidade "
        f"de triagem ativa do backlog mais antigo."
    )
    paginas.append(f"""
<div class="page">
{header_block("SOLICITAÇÃO DE REPARO", f"Solicitação de Reparo · Período: <b>{dados_p1['periodo_label_calendario']}</b>", "Mês de referência", mes_ref_label)}
  <div class="grid2">
    <div class="card" style="margin-bottom:0;">
      <div class="card-title">Situação das SRs — {sr['mes_anterior_label']} x {sr['mes_atual_label']}</div>
      <div class="card-body">
        <table>
          <thead><tr><th style="text-align:left;padding-left:8px;">Situação</th><th>{sr['mes_anterior_label']}</th><th>{sr['mes_atual_label']}</th></tr></thead>
          <tbody>
            <tr><td style="text-align:left;padding-left:8px;font-weight:700;">Atendida</td><td>{sit_ant['A']}</td><td style="font-weight:700;color:#166534;">{sit_a['A']}</td></tr>
            <tr><td style="text-align:left;padding-left:8px;font-weight:700;">Improcedente</td><td>{sit_ant['I']}</td><td>{sit_a['I']}</td></tr>
            <tr><td style="text-align:left;padding-left:8px;font-weight:700;">Não Atendida</td><td>{sit_ant['N']}</td><td style="font-weight:700;color:#991b1b;">{sit_a['N']}</td></tr>
            <tr style="background:#0f3d38;color:#fff;"><td style="text-align:left;padding-left:8px;font-weight:800;">Total</td><td style="font-weight:800;">{sit_ant['total']}</td><td style="font-weight:800;">{sit_a['total']}</td></tr>
          </tbody>
        </table>
      </div>
    </div>
    <div class="card" style="margin-bottom:0;">
      <div class="card-title">Aderência por Competência (Fechado até dia 3 do mês seguinte)</div>
      <div class="card-body">
        <div class="grid2">
          <div class="metric" style="border-left:4px solid #16a34a;"><div class="lbl">{sr['mes_anterior_label']} (fechado)</div><div class="val" style="color:#166534;">{comp_ant:.1f}%</div></div>
          <div class="metric"><div class="lbl">Meta</div><div class="val">{_fmt_int(meta_sr)}%</div></div>
          <div class="metric" style="border-left:4px solid #f59e0b;"><div class="lbl">{sr['mes_atual_label']} (parcial)</div><div class="val" style="color:#b45309;">{comp_atual:.1f}%</div></div>
          <div class="metric" style="border-left:4px solid #dc2626;"><div class="lbl">Gap vs Meta</div><div class="val" style="color:#dc2626;">{gap:+.1f}</div></div>
        </div>
      </div>
    </div>
  </div>
  <div class="card"><div class="card-title">Evolução da Aderência por Competência — {periodo_fim.year}</div><div class="card-body"><div class="chart-wrap">{img_tag('sr_ader')}</div></div></div>
  <div class="card">
    <div class="card-title">Solicitações Abertas em Sistema — Envelhecimento</div>
    <div class="card-body" style="display:flex;gap:16px;align-items:flex-start;">
      <div style="flex:1;">{img_tag('sr_aging')}</div>
      <div style="flex:0 0 210px;">
        <div class="metric" style="border-left:4px solid #991b1b;margin-bottom:8px;"><div class="lbl">Total em Aberto</div><div class="val" style="color:#991b1b;">{_fmt_int(sr['aberto_total'])}</div><div class="aux">SRs situação "Não Atendida"</div></div>
        <div style="font-size:9px;color:#334155;line-height:1.7;">Mais antiga em aberto: {_fmt_int(sr['mais_antiga_dias'])} dias.</div>
      </div>
    </div>
  </div>
  <div class="cons-box"><div class="cons-title">Considerações · Solicitação de Reparo</div><div class="cons-text">{cons_sr}</div></div>
{footer_block(8)}
</div>
""")

    # ===================== P9 · SR por Grupo =====================
    abg = sr["aberto_por_grupo"]; adg = sr["aderencia_por_grupo"]
    rows_aberto_grupo = "".join(
        f'<tr><td style="text-align:left;padding-left:6px;font-weight:700;">{r["grupo"]}</td><td style="font-weight:700;color:#991b1b;">{int(r["abertas"])}</td>'
        f'<td>{_num_br(r["idade_med"],0)} d</td><td>{_fmt_int(r["mais_antiga"])} d</td></tr>'
        for _, r in abg.head(12).iterrows()
    ) if not abg.empty else '<tr><td colspan="4" class="muted">Sem SRs em aberto</td></tr>'

    def _bar_color(pct):
        if pct < 65: return RED
        if pct < 80: return AMBER
        if pct < 94: return "#3b82f6"
        return "#16a34a"

    rows_ader_grupo = "".join(
        f'<tr><td style="text-align:left;padding-left:6px;font-weight:700;">{r["grupo"]}</td><td>{int(r["n"])}</td>'
        f'<td><div class="bar-cell"><div class="bar-wrap"><div class="bar" style="width:{min(r["pct"],100):.0f}%;background:{_bar_color(r["pct"])};"></div></div>'
        f'<span class="bar-val">{r["pct"]:.0f}%</span></div></td></tr>'
        for _, r in adg.sort_values("pct").head(14).iterrows()
    ) if not adg.empty else '<tr><td colspan="3" class="muted">Sem volume suficiente por grupo</td></tr>'

    pior_grupo = adg.sort_values("pct").iloc[0]["grupo"] if not adg.empty else "N/D"
    melhor_grupo = adg.sort_values("pct").iloc[-1]["grupo"] if not adg.empty else "N/D"
    grupo_mais_aberto = abg.iloc[0]["grupo"] if not abg.empty else "N/D"
    cons_grupo = (
        f"O grupo com maior volume de SRs em aberto é {grupo_mais_aberto}. Entre os grupos com volume relevante "
        f"no trimestre, {pior_grupo} apresenta a pior aderência por competência, enquanto {melhor_grupo} apresenta "
        f"a melhor. Recomenda-se priorizar mutirão nos grupos de pior aderência e maior backlog envelhecido, "
        f"cruzando com os veículos reincidentes identificados na análise de quebras."
    )
    paginas.append(f"""
<div class="page">
{header_block("SOLICITAÇÃO DE REPARO POR GRUPO", "Abertas: hoje · Aderência: trimestre", "Total em Aberto", _fmt_int(sr['aberto_total']))}
  <div class="grid2">
    <div class="card" style="margin-bottom:0;">
      <div class="card-title">O que está Aberto por Grupo</div>
      <div class="card-body"><table><thead><tr><th style="text-align:left;padding-left:6px;">Grupo</th><th>Abertas</th><th>Idade Média</th><th>Mais Antiga</th></tr></thead><tbody>{rows_aberto_grupo}</tbody></table></div>
    </div>
    <div class="card" style="margin-bottom:0;">
      <div class="card-title">Aderência por Grupo (Competência)</div>
      <div class="card-body"><table><thead><tr><th style="text-align:left;padding-left:6px;">Grupo</th><th>SRs</th><th>Aderência</th></tr></thead><tbody>{rows_ader_grupo}</tbody></table></div>
    </div>
  </div>
  <div class="cons-box"><div class="cons-title">Considerações · SR por Grupo</div><div class="cons-text">{cons_grupo}</div></div>
{footer_block(9)}
</div>
""")

    # ===================== P10 · Preventivas =====================
    pv = dados_prev
    rows_por_plano = "".join(
        f'<tr><td style="text-align:left;padding-left:6px;">{r["ds_plano"]}</td><td style="font-weight:700;color:#991b1b;">{int(r["qtd"])}</td></tr>'
        for _, r in pv["por_plano"].head(12).iterrows()
    ) if not pv["por_plano"].empty else '<tr><td colspan="2" class="muted">Nenhum plano vencido</td></tr>'
    rows_venc_detalhe = "".join(
        f'<tr><td style="font-weight:700;">{r.get("nr_ordem","")}</td><td style="text-align:left;padding-left:4px;">{r.get("ds_plano","")}</td>'
        f'<td style="font-weight:700;color:#991b1b;">{_fmt_int(r.get("km_vencido") or 0)}</td></tr>'
        for _, r in pv["df_vencidos"].head(10).iterrows()
    ) if not pv["df_vencidos"].empty else '<tr><td colspan="3" class="muted">Nenhum plano vencido</td></tr>'
    cons_prev = (
        f"A acuracidade do plano preventivo está em {pv['acuracidade_pct']:.1f}% ({_fmt_int(pv['em_dia'])} de "
        f"{_fmt_int(pv['total_planos'])} planos ativos em dia). Há {_fmt_int(pv['total_vencidos'])} planos vencidos "
        f"({pv.get('vencidos_por_km',0)} por km e {pv.get('vencidos_por_tempo',0)} por tempo), concentrados "
        f"principalmente em {(pv['por_plano'].iloc[0]['ds_plano'] if not pv['por_plano'].empty else 'nenhum plano específico')}. "
        f"O acompanhamento contínuo da acuracidade é essencial para manter a confiabilidade da frota."
    )
    paginas.append(f"""
<div class="page">
{header_block("CONTROLE DE PREVENTIVAS", f"Data de referência: <b>{_fmt_br_date(periodo_fim)}</b>", "Mês de referência", mes_ref_label)}
  <div class="card">
    <div class="card-title">Acuracidade do Plano Preventivo</div>
    <div class="card-body" style="display:flex;gap:12px;">
      <div class="metric" style="flex:1;border-left:4px solid #16a34a;"><div class="lbl">Acuracidade</div><div class="val" style="color:#16a34a;">{pv['acuracidade_pct']:.1f}%</div><div class="aux">Em dia ÷ Total</div></div>
      <div class="metric" style="flex:1;"><div class="lbl">Planos Ativos</div><div class="val">{_fmt_int(pv['total_planos'])}</div><div class="aux">In-house</div></div>
      <div class="metric" style="flex:1;"><div class="lbl">Em Dia</div><div class="val" style="color:#166534;">{_fmt_int(pv['em_dia'])}</div><div class="aux">Dentro do Prazo</div></div>
      <div class="metric" style="flex:1;border-left:4px solid #dc2626;"><div class="lbl">Vencidos</div><div class="val" style="color:#dc2626;">{_fmt_int(pv['total_vencidos'])}</div><div class="aux">{(pv['total_vencidos']/pv['total_planos']*100 if pv['total_planos'] else 0):.1f}% do Total</div></div>
    </div>
  </div>
  <div class="card">
    <div class="card-title">Planos Vencidos — {_fmt_int(pv['total_vencidos'])} Planos</div>
    <div class="card-body">
      <div style="display:flex;gap:16px;align-items:flex-start;">
        <div style="flex:0 0 260px;"><table><thead><tr><th style="text-align:left;padding-left:6px;">Plano</th><th>Vencidos</th></tr></thead><tbody>{rows_por_plano}</tbody></table></div>
        <div style="flex:1;"><table style="font-size:8.5px;"><thead><tr><th>Ordem</th><th style="text-align:left;padding-left:4px;">Plano</th><th>Km Vencido</th></tr></thead><tbody>{rows_venc_detalhe}</tbody></table></div>
      </div>
    </div>
  </div>
  <div class="cons-box"><div class="cons-title">Considerações · Preventivas</div><div class="cons-text">{cons_prev}</div></div>
{footer_block(10)}
</div>
""")

    # ===================== P11 · GNS =====================
    g = dados_gns
    def _trunc(s, n=40):
        s = str(s or "").strip()
        return (s[:n - 1] + "…") if len(s) > n else s

    df_parados_top = g["df_parados"].head(9) if not g["df_parados"].empty else pd.DataFrame()
    n_restante = (g["total_parado"] - len(df_parados_top)) if not g["df_parados"].empty else 0
    rows_parados = "".join(
        f'<tr><td style="font-weight:700;">{r.get("frota","")}</td><td>{r.get("categoria","")}</td><td>{r.get("setor","")}</td>'
        f'<td style="text-align:left;padding-left:6px;">{_trunc(r.get("descricao",""))}</td><td style="font-weight:700;color:#991b1b;">{int(r.get("dias_parado") or 0)}</td></tr>'
        for _, r in df_parados_top.iterrows()
    ) if not df_parados_top.empty else '<tr><td colspan="5" class="muted">Sem carros parados na sessão mais recente</td></tr>'
    if n_restante > 0:
        rows_parados += f'<tr><td colspan="5" class="muted">+ {n_restante} veículos parados há menos tempo</td></tr>'
    rows_setor = "".join(
        f'<tr><td style="text-align:left;padding-left:6px;font-weight:700;">{k}</td><td style="font-weight:700;">{v}</td></tr>'
        for k, v in sorted(g["por_setor"].items(), key=lambda x: -x[1])
    ) if g["por_setor"] else '<tr><td colspan="2" class="muted">Sem dados</td></tr>'
    mais_antigo = df_parados_top.iloc[0] if not df_parados_top.empty else None
    cons_gns = (
        f"O GNS médio de {dados_p1['mes_atual_label'].lower()} ficou em {_num_br(g['gns_medio'],1)} carros/dia útil, "
        f"considerando {g['dias_uteis']} dias úteis no período. Na sessão mais recente, {_fmt_int(g['total_parado'])} "
        f"veículos estavam parados aguardando manutenção" +
        (f", sendo o mais antigo o {mais_antigo.get('frota','N/D')} com {int(mais_antigo.get('dias_parado') or 0)} dias parado" if mais_antigo is not None else "") +
        ". O acompanhamento diário da fila de peças e da liberação é essencial para reduzir o tempo de carro parado."
    )
    paginas.append(f"""
<div class="page">
{header_block("GNS · CARROS PARADOS NA MANUTENÇÃO", f"Média de dias úteis · <b>{dados_p1['mes_atual_label']}</b>", "GNS Médio (dia útil)", _num_br(g['gns_medio'],1))}
  <div class="grid" style="grid-template-columns:repeat(3,1fr);margin-bottom:12px;">
    <div class="metric" style="border-left:4px solid #dc2626;"><div class="lbl">GNS Médio</div><div class="val" style="color:#dc2626;">{_num_br(g['gns_medio'],1)}</div><div class="aux">Média de dia útil</div></div>
    <div class="metric"><div class="lbl">Dias Úteis</div><div class="val">{g['dias_uteis']}</div><div class="aux">No período</div></div>
    <div class="metric" style="border-left:4px solid #991b1b;"><div class="lbl">Total Parado</div><div class="val">{_fmt_int(g['total_parado'])}</div><div class="aux">Sessão mais recente</div></div>
  </div>
  <div class="card"><div class="card-title">GNS por Dia</div><div class="card-body"><div class="chart-wrap">{img_tag('gns')}</div></div></div>
  <div class="grid" style="grid-template-columns:1.4fr 1fr;">
    <div class="card" style="margin-bottom:0;"><div class="card-title">Carros Parados — Mais Antigos</div><div class="card-body"><table><thead><tr><th>Veículo</th><th>Categoria</th><th>Setor</th><th style="text-align:left;padding-left:6px;">Motivo</th><th>Dias</th></tr></thead><tbody>{rows_parados}</tbody></table></div></div>
    <div class="card" style="margin-bottom:0;"><div class="card-title">Distribuição por Setor</div><div class="card-body"><table><thead><tr><th style="text-align:left;padding-left:6px;">Setor</th><th>Parados</th></tr></thead><tbody>{rows_setor}</tbody></table></div></div>
  </div>
  <div class="cons-box"><div class="cons-title">Considerações · GNS</div><div class="cons-text">{cons_gns}</div></div>
{footer_block(11)}
</div>
""")

    # ===================== P12 · Embarcados =====================
    e = dados_embarcados
    df_crit = e.get("df_criticos", pd.DataFrame())
    rows_crit = "".join(
        f'<tr><td>{pd.to_datetime(r["created_at"]).strftime("%d/%m/%Y") if pd.notna(r.get("created_at")) else "N/D"}</td>'
        f'<td style="font-weight:700;">{r.get("veiculo","")}</td><td>{r.get("tipo_embarcado","")}</td>'
        f'<td style="text-align:left;padding-left:6px;">{r.get("problema","")}</td>'
        f'<td><span class="pill" style="background:#fee2e2;color:#991b1b;">Crítica</span></td></tr>'
        for _, r in df_crit.head(12).iterrows()
    ) if not df_crit.empty else '<tr><td colspan="5" class="muted">Sem críticos em aberto</td></tr>'
    cons_emb = (
        f"Há {_fmt_int(e.get('criticos',0))} solicitações críticas de embarcados em aberto, de um total de "
        f"{_fmt_int(e.get('abertos',0))} solicitações abertas. No histórico, {_fmt_int(e.get('concluidas',0))} de "
        f"{_fmt_int(e.get('total',0))} solicitações já foram concluídas. Falhas em câmeras e vision comprometem a "
        f"segurança e a defesa jurídica em ocorrências, por isso os itens críticos devem ter prioridade máxima."
    )
    paginas.append(f"""
<div class="page">
{header_block("EMBARCADOS · CÂMERAS, MONITORAMENTO E VISION", "Prioridade Crítica em Aberto", "Críticos Abertos", _fmt_int(e.get('criticos',0)))}
  <div class="grid" style="grid-template-columns:repeat(4,1fr);margin-bottom:12px;">
    <div class="metric" style="border-left:4px solid #dc2626;"><div class="lbl">Críticos Abertos</div><div class="val" style="color:#dc2626;">{_fmt_int(e.get('criticos',0))}</div></div>
    <div class="metric"><div class="lbl">Total Abertos</div><div class="val">{_fmt_int(e.get('abertos',0))}</div><div class="aux">Todas prioridades</div></div>
    <div class="metric" style="border-left:4px solid #16a34a;"><div class="lbl">Concluídas</div><div class="val" style="color:#166534;">{_fmt_int(e.get('concluidas',0))}</div><div class="aux">De {_fmt_int(e.get('total',0))} no total</div></div>
    <div class="metric"><div class="lbl">Total Histórico</div><div class="val">{_fmt_int(e.get('total',0))}</div></div>
  </div>
  <div class="card"><div class="card-title">Câmeras / Vision Críticos em Aberto</div><div class="card-body"><table><thead><tr><th>Aberto em</th><th>Veículo</th><th>Tipo</th><th style="text-align:left;padding-left:6px;">Problema</th><th>Prioridade</th></tr></thead><tbody>{rows_crit}</tbody></table></div></div>
  <div class="card"><div class="card-title">Solicitações por Mês</div><div class="card-body">{img_tag('embarcados')}</div></div>
  <div class="cons-box"><div class="cons-title">Considerações · Embarcados</div><div class="cons-text">{cons_emb}</div></div>
{footer_block(12)}
</div>
""")

    # ===================== P13 · Oportunidades =====================
    o = dados_oport
    ex_rep = "".join(
        f'<li style="margin-bottom:4px;">Veículo <b>{ex["veiculo"]}</b> voltou a quebrar em {ex["dias"]} dia(s) — {ex["problema"]}</li>'
        for ex in o.get("exemplos_rep", [])
    ) or '<li>Sem exemplos no período</li>'
    paginas.append(f"""
<div class="page">
{header_block("OPORTUNIDADES DE MELHORIA", f"Base: <b>{_fmt_int(o['total_quebras'])} quebras válidas no trimestre</b>", "Mês de referência", mes_ref_label)}
  <div style="background:linear-gradient(90deg,#0f3d38 0%,#0d9488 100%);color:#fff;border-radius:12px;padding:10px 16px;margin-bottom:10px;">
    <div style="font-size:13px;font-weight:800;letter-spacing:0.3px;">A maioria das quebras dá sinal antes de acontecer.</div>
    <div style="font-size:10px;opacity:0.9;margin-top:3px;">De cada 10 quebras: {_num_br(o['rep_7d_pct']/10,1)} são de carro que já tinha quebrado nos últimos 7 dias · {_num_br(o['pos_prev_15d_pct']/10,1)} acontecem logo depois da preventiva (15 dias).</div>
  </div>
  <div class="card" style="margin-bottom:7px;border-left:5px solid #dc2626;">
    <div class="card-title" style="display:flex;justify-content:space-between;"><span>1 · Carro quebra, volta pra rua e quebra de novo</span><span>MAIOR OPORTUNIDADE</span></div>
    <div class="card-body" style="display:flex;gap:14px;padding:10px 13px;">
      <div style="flex:0 0 150px;text-align:center;border-right:1px solid #d6e3e0;padding-right:14px;">
        <div style="font-size:25px;font-weight:900;color:#dc2626;line-height:1;">{o['rep_7d_pct']:.0f}%</div>
        <div style="font-size:9px;color:#5b716c;text-transform:uppercase;font-weight:700;margin-top:4px;">das quebras são em carro que já quebrou há menos de 7 dias</div>
        <div style="font-size:18px;font-weight:900;color:#dc2626;margin-top:6px;line-height:1;">{o['rep_7d']}</div>
        <div style="font-size:9px;color:#5b716c;">quebras repetidas no trimestre</div>
      </div>
      <div style="flex:1;font-size:9.5px;color:#1f2937;line-height:1.42;">
        <b>Exemplos:</b><ul style="margin:6px 0 0 16px;padding:0;">{ex_rep}</ul><br/>
        <b style="color:#166534;">✔ Ação recomendada:</b> carro que retorna em até 7 dias não sai da garagem sem reinspeção por uma segunda pessoa (regra dos 4 olhos).
      </div>
    </div>
  </div>
  <div class="card" style="margin-bottom:7px;border-left:5px solid #2563eb;">
    <div class="card-title">2 · Carro quebra logo depois de passar pela preventiva</div>
    <div class="card-body" style="display:flex;gap:14px;padding:10px 13px;">
      <div style="flex:0 0 150px;text-align:center;border-right:1px solid #d6e3e0;padding-right:14px;">
        <div style="font-size:25px;font-weight:900;color:#1e3a8a;line-height:1;">{o['pos_prev_15d_pct']:.0f}%</div>
        <div style="font-size:9px;color:#5b716c;text-transform:uppercase;font-weight:700;margin-top:4px;">das quebras acontecem em até 15 dias após a preventiva</div>
        <div style="font-size:18px;font-weight:900;color:#1e3a8a;margin-top:6px;line-height:1;">{o['pos_prev_15d']}</div>
      </div>
      <div style="flex:1;font-size:9.5px;color:#1f2937;line-height:1.42;">
        <b>O que isso significa:</b> a revisão passou pelo carro e não pegou o problema que derrubou ele dias depois.<br/><br/>
        <b style="color:#166534;">✔ Ação recomendada:</b> toda quebra em até 15 dias pós-preventiva gera revisão da OS da preventiva, usada como insumo de treinamento.
      </div>
    </div>
  </div>
  <div class="card" style="margin-bottom:7px;">
    <div class="card-title">Atenção imediata · Fila de SRs não atendidas</div>
    <div class="card-body" style="display:flex;gap:14px;padding:10px 13px;align-items:center;">
      <div style="flex:0 0 150px;text-align:center;border-right:1px solid #d6e3e0;padding-right:14px;">
        <div style="font-size:25px;font-weight:900;color:#991b1b;line-height:1;">{_fmt_int(o['fila_srs'])}</div>
        <div style="font-size:9px;color:#5b716c;text-transform:uppercase;font-weight:700;margin-top:4px;">reclamações aguardando atendimento hoje</div>
      </div>
      <div style="flex:1;font-size:9.5px;color:#1f2937;line-height:1.42;">
        <b style="color:#166534;">✔ Ação recomendada:</b> triagem diária da fila por veículo; carro com 5+ SRs pendentes entra prioritário na programação da garagem.
      </div>
    </div>
  </div>
{footer_block(13)}
</div>
""")

    corpo = capa + "\n" + indice + "\n" + "\n".join(
        '<div class="page-break"></div>\n' + p for p in paginas
    )
    # Override: garante que qualquer <img> de gráfico (mesmo fora de .chart-wrap)
    # nunca ultrapasse a largura do container — evita overflow horizontal.
    extra_css = (
        ".card-body img{max-width:100%;height:auto;display:block;margin:0 auto;}"
    )
    html = (
        f'<!DOCTYPE html>\n<html lang="pt-BR">\n<head>\n<meta charset="UTF-8" />\n'
        f'<title>Flash Report Manutenção — Consolidado</title>\n<style>{theme_css}\n{extra_css}</style>\n</head>\n<body>\n'
        f'{corpo}\n</body>\n</html>\n'
    )
    html_path.write_text(html, encoding="utf-8")
    print(f"✅ HTML consolidado (teal, 15 páginas) salvo: {html_path}")


def gerar_pdf_do_html(html_path: Path, pdf_path: Path):
    html_path = html_path.resolve()
    pdf_path = pdf_path.resolve()

    with sync_playwright() as p:
        browser = p.chromium.launch(args=["--no-sandbox"])
        page = browser.new_page(viewport={"width": 1400, "height": 1000})
        page.goto(html_path.as_uri(), wait_until="networkidle")
        page.wait_for_timeout(500)
        page.pdf(
            path=str(pdf_path),
            format="A4",
            print_background=True,
            margin={"top": "0mm", "right": "0mm", "bottom": "0mm", "left": "0mm"},
            prefer_css_page_size=True,
        )
        browser.close()

    print(f"✅ PDF salvo: {pdf_path}")


# ==============================================================================
# MAIN
# ==============================================================================
def main():
    _assert_env()
    Path(PASTA_SAIDA).mkdir(parents=True, exist_ok=True)

    periodo_inicio = _parse_iso(REPORT_PERIODO_INICIO)
    periodo_fim = _parse_iso(REPORT_PERIODO_FIM)

    if not periodo_inicio and not periodo_fim:
        hoje = datetime.utcnow().date()
        periodo_inicio = month_start(hoje)
        periodo_fim = hoje
    elif periodo_inicio and not periodo_fim:
        periodo_fim = month_end(periodo_inicio)
    elif not periodo_inicio and periodo_fim:
        periodo_inicio = month_start(periodo_fim)

    atualizar_status_relatorio(
        "PROCESSANDO",
        tipo=REPORT_TIPO,
        periodo_inicio=str(periodo_inicio),
        periodo_fim=str(periodo_fim),
    )

    try:
        # ---- Processamento de todas as seções (15 páginas) ----
        dados_p1 = processar_pagina_1(periodo_inicio, periodo_fim)
        dados_p2 = processar_pagina_2(periodo_inicio, periodo_fim, dados_p1["df_diario_atual"], dados_p1["resumo_atual"])
        dados_p3 = processar_pagina_3(periodo_fim)
        dados_p4 = processar_pagina_4(periodo_fim)

        dados_regen = processar_regeneracao(periodo_inicio, periodo_fim)
        dados_borracharia = processar_borracharia(periodo_fim)
        dados_gns = processar_gns(periodo_inicio, periodo_fim)
        dados_embarcados = processar_embarcados()
        dados_motoristas = processar_motoristas(periodo_inicio, periodo_fim)
        dados_sr = processar_solicitacao_reparo(periodo_fim)
        dados_prev = processar_planos_vencidos()
        try:
            df_acuracidade_mensal = carregar_acuracidade_mensal(ate=periodo_fim)
        except Exception as e:
            print("⚠️ Histórico de acuracidade indisponível (não bloqueante):", repr(e))
            df_acuracidade_mensal = pd.DataFrame(columns=["mes", "data_fechamento", "acuracidade_pct", "vencidos", "total_planos"])
        dados_oport = processar_oportunidades(periodo_fim, sr_aberto_total=dados_sr.get("aberto_total", 0))

        try:
            registrar_snapshot_acuracidade(dados_prev, data_ref=periodo_fim)
        except Exception as e:
            print("⚠️ Snapshot acuracidade falhou (não bloqueante):", repr(e))

        # ---- Caminhos dos arquivos ----
        out_dir = Path(PASTA_SAIDA)
        img_path_p1 = out_dir / "flash_manutencao_mkbf_hist.png"
        img_path_p2 = out_dir / "flash_manutencao_diario.png"
        img_p3_linha = out_dir / "flash_manutencao_p3_linha.png"
        img_p3_horario = out_dir / "flash_manutencao_p3_horario.png"
        img_p3_top = out_dir / "flash_manutencao_p3_top_carro.png"
        img_regen = out_dir / "flash_manutencao_regen.png"
        img_gns = out_dir / "flash_manutencao_gns.png"
        img_sr_ader = out_dir / "flash_manutencao_sr_aderencia.png"
        img_sr_aging = out_dir / "flash_manutencao_sr_aging.png"
        img_embarcados = out_dir / "flash_manutencao_embarcados.png"
        img_motoristas = out_dir / "flash_manutencao_motoristas.png"
        img_borracharia = out_dir / "flash_manutencao_borracharia.png"

        html_path = out_dir / "Flash_Report_Manutencao.html"
        pdf_path = out_dir / "Flash_Report_Manutencao.pdf"

        # ---- Geração dos gráficos ----
        gerar_grafico_mkbf_historico(dados_p1["df_hist"], img_path_p1)
        gerar_grafico_pagina_2(dados_p2, img_path_p2)
        gerar_grafico_pagina_3_linha(dados_p3["df_linha"], img_p3_linha)
        gerar_grafico_pagina_3_horario(dados_p3["df_horario"], img_p3_horario)
        gerar_grafico_pagina_3_top_carro(dados_p3["df_top_carro"], img_p3_top)

        mes_ref_period = pd.Period(periodo_fim, "M")
        gerar_grafico_regen_mensal(dados_regen["evolucao_mensal"], mes_ref_period, img_regen)
        gerar_grafico_gns_diario(dados_gns["df_diario"], dados_gns["gns_medio"], img_gns)
        gerar_grafico_sr_aderencia(dados_sr["competencia_mensal"], dados_sr["meta_competencia"], img_sr_ader)
        gerar_grafico_sr_aging(dados_sr["buckets_aberto"], img_sr_aging)
        gerar_grafico_embarcados_mensal(dados_embarcados["por_mes"], mes_ref_period, img_embarcados)
        gerar_grafico_motoristas_improcedentes(dados_motoristas["improcedentes_por_mes"], periodo_fim.year, img_motoristas)
        gerar_grafico_borracharia_trocas(dados_borracharia["trocas_por_mes"], dados_borracharia["mes_ref"], img_borracharia)

        img_map = {
            "mkbf_hist": img_path_p1, "p2_diario": img_path_p2,
            "p3_linha": img_p3_linha, "p3_horario": img_p3_horario, "p3_top": img_p3_top,
            "regen": img_regen, "gns": img_gns, "sr_ader": img_sr_ader, "sr_aging": img_sr_aging,
            "embarcados": img_embarcados, "motoristas": img_motoristas, "borracharia": img_borracharia,
        }

        gerar_html_consolidado_teal(
            dados_p1, dados_p2, dados_p3, dados_p4,
            dados_regen, dados_borracharia, dados_gns,
            dados_embarcados, dados_motoristas, dados_sr,
            dados_prev, df_acuracidade_mensal, dados_oport,
            img_map, html_path,
        )

        gerar_pdf_do_html(html_path, pdf_path)

        # Configuração para upload (diretório unificado do relatório)
        mes_ref = f"{periodo_fim.year}-{str(periodo_fim.month).zfill(2)}"
        stamp = datetime.utcnow().strftime("%Y%m%d_%H%M%S")
        base_folder = f"{REMOTE_BASE_PREFIX}/{mes_ref}/flash_report/{stamp}"

        # Enviando arquivos para o Supabase
        for img in img_map.values():
            upload_storage_b(img, f"{base_folder}/{img.name}", "image/png")

        upload_storage_b(html_path, f"{base_folder}/{html_path.name}", "text/html; charset=utf-8")
        upload_storage_b(pdf_path, f"{base_folder}/{pdf_path.name}", "application/pdf")

        # Status Final
        atualizar_status_relatorio(
            "CONCLUIDO",
            arquivo_pdf_path=f"{base_folder}/{pdf_path.name}",
            arquivo_html_path=f"{base_folder}/{html_path.name}",
            arquivo_png_path=f"{base_folder}/{img_path_p1.name}",
            erro_msg=None,
            mes_ref=mes_ref,
        )

        print("✅ [OK] Flash Report Manutenção (Consolidado, 15 páginas) concluído.")
        print(f"📄 PDF Unificado: {pdf_path}")
        print(f"🌐 HTML: {html_path}")
        print(f"☁️ Storage base: {base_folder}")

    except Exception as e:
        err = repr(e)
        print("❌ ERRO:", err)
        try:
            atualizar_status_relatorio("ERRO", erro_msg=err)
        except Exception:
            pass
        raise


if __name__ == "__main__":
    main()
