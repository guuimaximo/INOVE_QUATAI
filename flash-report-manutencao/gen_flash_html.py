# gen_flash_html.py
# ------------------------------------------------------------------------------
# FLASH REPORT MANUTENÇÃO — VERSÃO HTML INTERATIVA
# Extrai os dados ao vivo do Supabase (mesmas regras do gen_flash_manutencao.py),
# embute como JSON num único HTML (flash_dinamico_template.html) com drill-down.
# ------------------------------------------------------------------------------
import json
import os
import sys
from datetime import date, datetime
from zoneinfo import ZoneInfo
from pathlib import Path

import pandas as pd

AQUI = Path(__file__).resolve().parent
GERADOR_DIR = Path(os.getenv("FLASH_MANUT_DIR", str(AQUI)))
sys.path.insert(0, str(GERADOR_DIR))
import gen_flash_manutencao as g  # noqa: E402
import extras_loaders as x  # noqa: E402

MESES_JANELA = int(os.getenv("FLASH_HTML_MESES", "8"))
SAIDA = Path(os.getenv("FLASH_HTML_SAIDA", AQUI / "Flash Report - Manutencao.html"))
TEMPLATE = AQUI / "flash_dinamico_template.html"


def _s(v):
    if v is None or (isinstance(v, float) and pd.isna(v)):
        return ""
    if isinstance(v, float) and v.is_integer():
        v = int(v)
    s = str(v).strip()
    if s.endswith(".0") and s[:-2].isdigit():
        s = s[:-2]
    return "" if s.lower() in ("nan", "none", "<na>") else s


ROLE_COLS = ("mecanico", "eletricista", "funilaria", "borracharia")


def _nome_func(v):
    """'30060966 - ANDERSON ...' -> 'ANDERSON ...' (mesma regra do SOS_Resumo)."""
    s = _s(v)
    return (s.split(" - ", 1)[1] or s).strip() if " - " in s else s


def _role(setor, grupo):
    """Quem responde pela quebra na revisão (mapSetorToRole do SOS_Resumo)."""
    s, gr = _s(setor).upper(), _s(grupo).upper()
    if "ELÉTRICA" in s or "ELETRICA" in s or "ELÉTRICA" in gr or "ELETRICA" in gr:
        return "eletricista"
    if "BORRACHARIA" in s or "PNEU" in gr:
        return "borracharia"
    if "FUNILARIA" in s or "CARROCERIA" in s or "CARROCERIA" in gr:
        return "funilaria"
    return "mecanico"


def _dias(a: str, b: str):
    try:
        return (date.fromisoformat(a[:10]) - date.fromisoformat(b[:10])).days
    except (TypeError, ValueError):
        return None


def carregar_preventivas_inove() -> dict:
    """Tabela preventivas do INOVE: base da avaliação de técnicos (quem revisou o carro)."""
    df = g._fetch_all_rows(g._sb_b(), "preventivas",
                           "prefixo, numero_os, data_realizacao, km_veiculo, tipo, " + ", ".join(ROLE_COLS))
    if df.empty:
        return {"por_os": {}, "lista": []}
    por_os, lista = {}, []
    for r in df.to_dict("records"):
        d = _s(r.get("data_realizacao"))[:10]
        os_ = _s(r.get("numero_os"))
        reg = {"d": d, "km": r.get("km_veiculo"), **{c: _nome_func(r.get(c)) for c in ROLE_COLS}}
        if os_:
            por_os[os_] = reg
        if d:
            lista.append([d, _s(r.get("prefixo")), _s(r.get("tipo")), os_] + [reg[c] for c in ROLE_COLS])
    return {"por_os": por_os, "lista": lista}


def carregar_intervencoes(ini: date, fim: date, prev_por_os: dict | None = None) -> list[dict]:
    rows = g.fetch_all_table_period(
        table_name="sos_acionamentos",
        select_fields=("id, numero_sos, data_sos, hora_sos, veiculo, linha, ocorrencia, status, "
                       "setor_manutencao, grupo_manutencao, problema_encontrado, reclamacao_motorista, "
                       "solucao, classificacao_controlabilidade, motorista_nome, local_ocorrencia, "
                       "carro_substituto, sr_numero, numero_os_corretiva, km_veiculo_sos, data_encerramento, "
                       "data_fechamento, dias_ultima_preventiva, dias_ultima_inspecao, data_ultima_preventiva, "
                       "data_ultima_inspecao, os_ultima_preventiva, os_ultima_inspecao, km_rodado_preventiva, "
                       "km_rodado_inspecao"),
        date_field="data_sos", start_date=ini, end_date=fim,
    )
    df = pd.DataFrame(rows)
    if df.empty:
        return []
    mapa_def = g._rotulo_defeito_canonico(df["problema_encontrado"])
    prev_por_os = prev_por_os or {}
    out = []
    for r in df.to_dict("records"):
        prob = _s(r.get("problema_encontrado"))
        veic = _s(r.get("veiculo"))
        tipo = g.normalize_tipo(r.get("ocorrencia"))
        d_sos = _s(r.get("data_sos"))[:10]
        # --- revisão vinculada (mesma regra do SOS_Resumo: OS da última prev./inspeção) ---
        vp = prev_por_os.get(_s(r.get("os_ultima_preventiva")))
        vi = prev_por_os.get(_s(r.get("os_ultima_inspecao")))
        base_p = (vp or {}).get("d") or _s(r.get("data_ultima_preventiva"))[:10]
        base_i = (vi or {}).get("d") or _s(r.get("data_ultima_inspecao"))[:10]
        n_dp, n_di = g._to_num(pd.Series([r.get("dias_ultima_preventiva"), r.get("dias_ultima_inspecao")])).tolist()
        dp = n_dp if (n_dp or 0) > 0 else (max(0, _dias(d_sos, base_p) or 0) if base_p else None)
        di = n_di if (n_di or 0) > 0 else (max(0, _dias(d_sos, base_i) or 0) if base_i else None)
        insp_recente = bool(base_i and base_p and (di or 0) < (dp or 0)) or bool(base_i and not base_p)
        role = _role(r.get("setor_manutencao"), r.get("grupo_manutencao"))
        vinc = vi if insp_recente else vp
        km_rev = ((vinc or {}).get("km") or
                  r.get("km_rodado_inspecao" if insp_recente else "km_rodado_preventiva") or 0)
        km_sos = g._to_num(pd.Series([r.get("km_veiculo_sos")])).iloc[0]
        km_rev = g._to_num(pd.Series([km_rev])).iloc[0]
        rk = max(0.0, km_sos - km_rev) if (km_sos or 0) > 0 and (km_rev or 0) > 0 else None
        out.append({
            "id": r.get("id"),
            "n": _s(r.get("numero_sos")),
            "d": _s(r.get("data_sos"))[:10],
            "h": _s(r.get("hora_sos"))[:5],
            "v": veic or "N/D",
            "cl": g.definir_cluster_manutencao(veic),
            "l": _s(r.get("linha")) or "N/D",
            "t": tipo or "SEM TIPO",
            "ok": bool(g.is_ocorrencia_valida_para_mkbf(r.get("ocorrencia"))),
            "st": _s(r.get("status")),
            "se": _s(r.get("setor_manutencao")) or "N/D",
            "gr": _s(r.get("grupo_manutencao")) or "N/D",
            "p": mapa_def.get(prob, prob) or "N/D",
            "rc": _s(r.get("reclamacao_motorista")),
            "so": _s(r.get("solucao")),
            "ct": _s(r.get("classificacao_controlabilidade")),
            "mo": _s(r.get("motorista_nome")),
            "lo": _s(r.get("local_ocorrencia")),
            "cs": _s(r.get("carro_substituto")),
            "sr": _s(r.get("sr_numero")),
            "os": _s(r.get("numero_os_corretiva")),
            "em": g.classificar_embarcado(r.get("grupo_manutencao"), prob, r.get("reclamacao_motorista")) or "",
            "fe": (_s(r.get("data_encerramento")) or _s(r.get("data_fechamento")))[:10],
            "dp": None if dp is None else int(dp), "di": None if di is None else int(di),
            "rt": "I" if insp_recente else "P",
            "rr": ((vinc or {}).get(role) or ""),
            "fn": role,
            "rd": None if (di if insp_recente else dp) is None else int(di if insp_recente else dp),
            "rk": None if rk is None else round(float(rk)),
        })
    return out


def carregar_km(ini: date, fim: date) -> tuple[list, list]:
    rows = g.fetch_all_table_period(
        table_name="indicadores_diesel", select_fields="data_consolidada, veiculo, km_transnet, combustivel_transnet",
        date_field="data_consolidada", start_date=ini, end_date=fim, sb_client=g._sb_a(),
    )
    df = pd.DataFrame(rows)
    if df.empty:
        return [], []
    df["km"] = g._to_num(df["km_transnet"]).fillna(0)
    df["lt"] = g._to_num(df["combustivel_transnet"]).fillna(0)
    df = df[df["km"] > 0].copy()
    df["veiculo"] = df["veiculo"].astype(str).str.strip()
    df["cl"] = df["veiculo"].apply(g.definir_cluster_manutencao)
    df["d"] = df["data_consolidada"].astype(str).str[:10]
    df["m"] = df["d"].str[:7]
    dia_cl = df.groupby(["d", "cl"], as_index=False)[["km", "lt"]].sum()
    mes_v = df.groupby(["m", "veiculo"], as_index=False).agg(km=("km", "sum"), dias=("d", "nunique"))
    return (
        [[r.d, r.cl, round(r.km, 1), round(r.lt, 1)] for r in dia_cl.itertuples()],
        [[r.m, r.veiculo, round(r.km, 1), int(r.dias)] for r in mes_v.itertuples()],
    )


def carregar_planos() -> list:
    df = g._fetch_ultimo_plano()
    if df.empty:
        return []
    for c in ["qt_km_intervalo", "qt_dia_intervalo", "km_para_proxima", "dias_vencido"]:
        df[c] = g._to_num(df.get(c))
    if "cs_ativo" in df.columns:
        df = df[df["cs_ativo"].astype(str).str.upper() != "N"].copy()
    df = df[~df["ds_plano"].astype(str).str.contains("CONCESS", case=False, na=False)]
    df["vencido"] = df.apply(g._plano_vencido, axis=1)
    out = []
    for r in df.to_dict("records"):
        por_km = (r.get("qt_km_intervalo") or 0) > 0
        out.append([
            _s(r.get("nr_ordem")), _s(r.get("ds_plano")), bool(r["vencido"]), por_km,
            None if pd.isna(r.get("km_para_proxima")) else float(r["km_para_proxima"]),
            None if pd.isna(r.get("dias_vencido")) else float(r["dias_vencido"]),
        ])
    return out


def main():
    g._assert_env()
    hoje = datetime.now(ZoneInfo("America/Sao_Paulo")).date()
    ini = min(g.month_start(g.add_months(hoje, -(MESES_JANELA - 1))), date(hoje.year, 1, 1))
    print(f"Janela: {ini} a {hoje}")

    prev_inove = carregar_preventivas_inove()
    interv = carregar_intervencoes(ini, hoje, prev_inove["por_os"])
    km_dia_cl, km_mes_v = carregar_km(ini, hoje)
    planos = carregar_planos()
    regen = x.carregar_regeneracao(ini, hoje)
    borr = x.carregar_borracharia()
    sr = x.carregar_sr(date(hoje.year, 1, 1))
    gns = x.carregar_gns(ini, hoje)
    emb_sr = x.carregar_embarcados_sr()
    prev_real = x.carregar_preventivas_realizadas()
    pcm_ent = x.carregar_pcm_entradas(ini)

    dados = {
        "gerado_em": datetime.now(ZoneInfo("America/Sao_Paulo")).strftime("%d/%m/%Y %H:%M"),
        "ini": str(ini), "fim": str(hoje),
        "meta_mkbf": g.MKBF_META,
        "interv": interv, "km_dia_cl": km_dia_cl, "km_mes_v": km_mes_v, "planos": planos,
        "regen": regen, "borr": borr, "sr": sr, "sr_meta": float(os.getenv("REPORT_SR_META", "94")),
        "gns": gns, "emb_sr": emb_sr, "prev_real": prev_real,
        "prev_func": [l for l in prev_inove["lista"] if l[0] >= str(ini)], "pcm_ent": pcm_ent,
    }
    js = json.dumps(dados, ensure_ascii=False, separators=(",", ":")).replace("</", "<\\/")
    html = TEMPLATE.read_text(encoding="utf-8").replace("/*__DADOS__*/null", js)
    SAIDA.write_text(html, encoding="utf-8")
    print(f"OK: {SAIDA} ({SAIDA.stat().st_size/1024:.0f} KB) — {len(interv)} intervenções, "
          f"{len(km_mes_v)} veículo-mês, {len(planos)} planos, {len(regen)} regen, {len(sr)} SR, "
          f"{len(gns['dias'])} sessões PCM, {len(emb_sr)} SR embarcados, {len(borr['trocas'])} trocas, "
          f"{len(prev_real)} preventivas, {len(pcm_ent['rows'])} entradas PCM")
    return dados


if __name__ == "__main__":
    main()
