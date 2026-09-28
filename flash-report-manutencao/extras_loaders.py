# Loaders das seções além das intervenções (regeneração, pneus, SR, GNS, embarcados, preventivas).
# Importado pelo gen_flash_html.py.
import os
from datetime import date

import pandas as pd

import gen_flash_manutencao as g


def _s(v):
    if v is None or (isinstance(v, float) and pd.isna(v)):
        return ""
    if isinstance(v, float) and v.is_integer():
        v = int(v)
    s = str(v).strip()
    if s.endswith(".0") and s[:-2].isdigit():
        s = s[:-2]
    return "" if s.lower() in ("nan", "none", "<na>") else s


def _num(v):
    try:
        f = float(v)
        return None if pd.isna(f) else round(f, 2)
    except (TypeError, ValueError):
        return None


def _ts(v, n=16):
    """ISO -> 'AAAA-MM-DD HH:MM' no fuso de Brasília quando vier com offset."""
    s = _s(v)
    if not s:
        return ""
    try:
        t = pd.Timestamp(s)
        if t.tzinfo is not None:
            t = t.tz_convert("America/Sao_Paulo").tz_localize(None)
        return t.strftime("%Y-%m-%d %H:%M")[:n]
    except Exception:
        return s[:n]


def carregar_regeneracao(ini: date, fim: date) -> list:
    rows = g.fetch_all_table_period(
        table_name="eventos_regeneracao",
        select_fields="prefixo, motorista, dt_inicio, duracao_min, rpm_medio, consumo_litros, custo_reais",
        date_field="dt_inicio", start_date=ini, end_date=fim, sb_client=g._sb_a(),
    )
    return [[_s(r.get("prefixo")), _s(r.get("motorista")), _ts(r.get("dt_inicio")),
             _num(r.get("duracao_min")), _num(r.get("rpm_medio")), _num(r.get("consumo_litros")),
             _num(r.get("custo_reais"))] for r in rows]


def carregar_borracharia() -> dict:
    sb = g._sb_b()
    tr = g._fetch_all_rows(sb, "pcm_troca_pneus",
                           "created_at, tipo_troca, prefixo_instalacao, prefixo_retirada, posicao, "
                           "numero_fogo_retirado, numero_fogo_colocado, observacoes, criado_por_nome, pneu_conserto")
    trocas = [[_ts(r.get("created_at")), _s(r.get("tipo_troca")),
               _s(r.get("prefixo_instalacao")) or _s(r.get("prefixo_retirada")), _s(r.get("posicao")),
               _s(r.get("numero_fogo_retirado")), _s(r.get("numero_fogo_colocado")), _s(r.get("observacoes")),
               _s(r.get("criado_por_nome")), _s(r.get("pneu_conserto"))]
              for r in tr.to_dict("records")] if not tr.empty else []
    pn = g._fetch_all_rows(sb, "pcm_pneus_transnet_ativos",
                           "numero_fogo, vida_atual, localizacao, km_rodada, marca, medida, posicao, dot")
    pneus = [[_s(r.get("numero_fogo")), _s(r.get("vida_atual")), _s(r.get("localizacao")),
              _num(r.get("km_rodada")), _s(r.get("marca")), _s(r.get("medida")), _s(r.get("posicao")),
              _s(r.get("dot"))] for r in pn.drop_duplicates("numero_fogo").to_dict("records")] if not pn.empty else []
    vw = g._fetch_all_rows(sb, "vw_pcm_controle_pneus_central",
                           "status, numero_fogo_base, numero_fogo_aud, prefixo_base, posicao, auditoria_em, auditado_por")
    ctrl = [[_s(r.get("prefixo_base")), _s(r.get("posicao")), _s(r.get("numero_fogo_base")),
             _s(r.get("numero_fogo_aud")), _s(r.get("status")), _ts(r.get("auditoria_em"), 10),
             _s(r.get("auditado_por"))] for r in vw.to_dict("records")] if not vw.empty else []
    fis = os.getenv("REPORT_BORRACHARIA_FISICO")
    return {"trocas": trocas, "pneus": pneus, "ctrl": ctrl,
            "fisico": int(fis) if (fis or "").isdigit() else None}


def carregar_sr(ini: date) -> list:
    """SRs do ano (competência) + todas as não atendidas anteriores (fila de hoje)."""
    sb = g._sb_a()
    cols = ("cd_reclamacao, dt_reclamacao, cs_situacao, ds_motivo_reclamacao, status_competencia, "
            "nr_ordem, ds_observacao, nm_funcionario, dt_fim_reclamacao")
    ano = g.fetch_all_table_period("solicitacao_reparo", cols, "dt_reclamacao", ini, date.today(), sb_client=sb)
    abertas, off = [], 0
    while True:
        rs = (sb.table("solicitacao_reparo").select(cols).eq("cs_situacao", "N")
              .lt("dt_reclamacao", str(ini)).range(off, off + 999).execute().data or [])
        abertas += rs
        if len(rs) < 1000:
            break
        off += 1000
    vistos, out = set(), []
    for r in ano + abertas:
        k = _s(r.get("cd_reclamacao"))
        if k in vistos:
            continue
        vistos.add(k)
        out.append([k, _s(r.get("dt_reclamacao"))[:10], _s(r.get("cs_situacao")).upper(),
                    _s(r.get("ds_motivo_reclamacao")).strip().upper() or "N/D",
                    _s(r.get("status_competencia")).lower() == "fechado",
                    _s(r.get("nr_ordem")), _s(r.get("ds_observacao")), _s(r.get("nm_funcionario")),
                    _s(r.get("dt_fim_reclamacao"))[:10]])
    return out


def carregar_gns(ini: date, fim: date) -> dict:
    """Mesma regra do processar_gns: em aberto na sessão = data_saida nula e entrada <= data."""
    sb = g._sb_b()
    sess = (sb.table("pcm_diario").select("id, data_referencia").gte("data_referencia", str(ini))
            .lte("data_referencia", str(fim)).order("data_referencia").execute().data or [])
    ids = [s["id"] for s in sess]
    vs = []
    for i in range(0, len(ids), 40):
        off = 0
        while True:
            rs = (sb.table("veiculos_pcm")
                  .select("pcm_id, frota, categoria, setor, descricao, observacao, data_entrada, data_saida, previsao")
                  .in_("pcm_id", ids[i:i + 40]).is_("data_saida", "null")
                  .range(off, off + 999).execute().data or [])
            vs += rs
            if len(rs) < 1000:
                break
            off += 1000
    df = pd.DataFrame(vs)
    if not df.empty:
        # mesma conversão do gerador do PDF (tz_localize(None) sobre o timestamp UTC)
        df["ent"] = pd.to_datetime(df["data_entrada"], errors="coerce").dt.tz_localize(None)
    feriados = g._feriados()
    dias, regs, idx = [], [], {}
    for s in sess:
        dt = g._parse_iso(s["data_referencia"])
        util = dt.weekday() < 5 and dt not in feriados
        carros = []
        if not df.empty:
            dv = df[df["pcm_id"] == s["id"]]
            dv = dv[dv["ent"].dt.normalize() <= pd.Timestamp(dt)].drop_duplicates("frota")
            for r in dv.to_dict("records"):
                reg = (_s(r.get("frota")), _s(r.get("categoria")), _s(r.get("setor")),
                       _s(r.get("descricao")), _s(r.get("observacao")),
                       r["ent"].strftime("%Y-%m-%d") if pd.notna(r["ent"]) else "",
                       _s(r.get("previsao"))[:10])
                if reg not in idx:
                    idx[reg] = len(regs)
                    regs.append(list(reg))
                carros.append(idx[reg])
        dias.append({"d": s["data_referencia"], "u": bool(util), "c": carros})
    return {"dias": dias, "regs": regs}  # dias[i].c = índices em regs (carros repetem dia a dia)


def carregar_embarcados_sr() -> list:
    rows = (g._sb_b().table("embarcados_solicitacoes_reparo")
            .select("veiculo, tipo_embarcado, problema, descricao, local_problema, prioridade, status, "
                    "solicitante, executado_por, created_at, data_fechamento, observacao_execucao")
            .execute().data or [])
    return [[_s(r.get("veiculo")), _s(r.get("tipo_embarcado")), _s(r.get("problema")), _s(r.get("descricao")),
             _s(r.get("local_problema")), _s(r.get("prioridade")).upper(), _s(r.get("status")).upper(),
             _s(r.get("solicitante")), _s(r.get("executado_por")), _ts(r.get("created_at")),
             _ts(r.get("data_fechamento")), _s(r.get("observacao_execucao"))] for r in rows]


def carregar_preventivas_realizadas() -> list:
    """Datas de preventiva por carro (INOVE + OS do TransNet) — base do cruzamento pós-preventiva."""
    out = []
    try:
        pv = g._fetch_all_rows(g._sb_b(), "preventivas", "prefixo, data_realizacao, tipo, numero_os")
        for r in pv.to_dict("records"):
            d = _s(r.get("data_realizacao"))[:10]
            if d:
                out.append([_s(r.get("prefixo")), d, _s(r.get("tipo")), _s(r.get("numero_os")), "INOVE"])
    except Exception as e:
        print("⚠️ preventivas INOVE:", repr(e))
    try:
        pl = g._fetch_all_rows(g._sb_a(), "ultimo_plano", "nr_ordem, cd_ordem_servico, dt_abertura_os, ds_plano")
        if not pl.empty:
            pl["_p"] = (pl["ds_plano"].astype(str).str.normalize("NFKD").str.encode("ascii", "ignore")
                        .str.decode("ascii").str.upper())
            eh = (pl["_p"].str.contains("REVISAO PESADA", regex=False)
                  | pl["_p"].str.contains("INSPECAO 5.000", regex=False))
            os_prev = pl.loc[eh, "cd_ordem_servico"].unique()
            pl = pl[pl["cd_ordem_servico"].isin(os_prev) & eh].drop_duplicates("cd_ordem_servico")
            for r in pl.to_dict("records"):
                d = _s(r.get("dt_abertura_os"))[:10]
                if d:
                    out.append([_s(r.get("nr_ordem")), d, _s(r.get("ds_plano")),
                                _s(r.get("cd_ordem_servico")), "TransNet"])
    except Exception as e:
        print("⚠️ ultimo_plano OS:", repr(e))
    return out


def carregar_pcm_entradas(ini: date) -> dict:
    """Entradas na oficina (veiculos_pcm) — base do PCM › Resumo do INOVE.

    Traz as entradas com data_entrada >= ini, as sem data_entrada ligadas a sessões
    da janela (data efetiva = data_referencia da sessão) e todo o backlog em aberto
    (data_saida nula), para taxa de resolução, turno, reentradas, aging e motivos.
    """
    sb = g._sb_b()
    sess = g._fetch_all_rows(sb, "pcm_diario", "id, data_referencia")
    ref = {r["id"]: _s(r["data_referencia"])[:10] for r in sess.to_dict("records")} if not sess.empty else {}
    cols = ("id, pcm_id, frota, setor, categoria, ordem_servico, descricao, observacao, "
            "data_entrada, data_saida, lancado_no_turno")

    def _pag(build):
        out, off = [], 0
        while True:
            rs = build().range(off, off + 999).execute().data or []
            out += rs
            if len(rs) < 1000:
                return out
            off += 1000

    a = _pag(lambda: sb.table("veiculos_pcm").select(cols).gte("data_entrada", f"{ini}T00:00:00").order("id"))
    b = _pag(lambda: sb.table("veiculos_pcm").select(cols).is_("data_saida", "null").order("id"))
    ids_janela = [k for k, d in ref.items() if d >= str(ini)]
    c = []
    for i in range(0, len(ids_janela), 40):
        c += _pag(lambda: sb.table("veiculos_pcm").select(cols).is_("data_entrada", "null")
                  .in_("pcm_id", ids_janela[i:i + 40]).order("id"))
    # A virada diária do PCM copia o carro parado para a sessão seguinte com a MESMA
    # data_entrada: sem colapsar, um carro parado 10 dias vira 10 "entradas".
    # Uma entrada física = (frota, data_entrada); vale o estado da sessão mais recente
    # (categoria/setor/motivo atuais) e a saída preenchida em qualquer cópia.
    vistos, grupos = set(), {}
    for r in a + b + c:
        if r["id"] in vistos:
            continue
        vistos.add(r["id"])
        dref = ref.get(r.get("pcm_id"), "")
        ent = _ts(r.get("data_entrada"))
        k = (_s(r.get("frota")), ent or ("REF " + dref))
        grupos.setdefault(k, []).append((dref, r))
    rows = []
    for (frota, _), lst in grupos.items():
        lst.sort(key=lambda t: t[0])
        ult = lst[-1][1]
        saidas = [_ts(r.get("data_saida")) for _, r in lst if r.get("data_saida")]
        turno = next((_s(r.get("lancado_no_turno")).upper() for _, r in lst if r.get("lancado_no_turno")), "")
        rows.append([frota, _s(ult.get("setor")), _s(ult.get("categoria")), _s(ult.get("ordem_servico")),
                     _s(ult.get("descricao")), _s(ult.get("observacao")), _ts(ult.get("data_entrada")),
                     max(saidas) if saidas else "", turno, lst[0][0]])
    # dias com PCM por mês (denominador da média de GNS/dia do PCM › Resumo)
    dias_pcm = sorted({d for d in ref.values() if d >= str(ini)})
    return {"rows": rows, "dias": dias_pcm}
