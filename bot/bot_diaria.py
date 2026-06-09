# bot/bot_diaria.py
# Worker da conferência diária. Roda no GitHub Actions (cron a cada N min) ou local.
# Pega o próximo job pendente em suprimentos_bot_jobs, busca o saldo do ERP
# no dia D, escreve saldo_erp+diferenca em cada linha de suprimentos_contagens
# daquele dia, marca o job como concluido.

from __future__ import annotations

import argparse
import os
import sys
import time
import traceback
from datetime import datetime, timedelta
from pathlib import Path
from typing import Dict

print("[diaria] boot do script", flush=True)

import requests

sys.path.insert(0, str(Path(__file__).resolve().parent))
print("[diaria] importando transnet...", flush=True)
from transnet import gerar_estoque_virtual_csv, tratar_estoque_virtual  # noqa: E402
print("[diaria] transnet importado.", flush=True)

SUPABASE_URL = os.environ.get("SUPABASE_URL", "")
SUPABASE_KEY = os.environ.get("SUPABASE_SERVICE_KEY") or os.environ.get("SUPABASE_ANON_KEY", "")

if not SUPABASE_URL or not SUPABASE_KEY:
    print("[diaria] SUPABASE_URL / SUPABASE_SERVICE_KEY ausentes.", flush=True)
    sys.exit(0)
print(f"[diaria] supabase ok ({SUPABASE_URL[:40]}...)", flush=True)

HEADERS = {
    "apikey": SUPABASE_KEY,
    "Authorization": f"Bearer {SUPABASE_KEY}",
    "Content-Type": "application/json",
    "Prefer": "return=representation",
}


def supa_get(path: str, params: dict = None) -> list:
    r = requests.get(f"{SUPABASE_URL}/rest/v1/{path}", headers=HEADERS, params=params or {}, timeout=60)
    r.raise_for_status()
    return r.json()


def supa_patch(path: str, params: dict, payload: dict) -> list:
    r = requests.patch(f"{SUPABASE_URL}/rest/v1/{path}", headers=HEADERS, params=params, json=payload, timeout=60)
    r.raise_for_status()
    return r.json() if r.content else []


def supa_insert(path: str, payload: dict) -> dict:
    r = requests.post(f"{SUPABASE_URL}/rest/v1/{path}", headers=HEADERS, json=payload, timeout=60)
    r.raise_for_status()
    return r.json()[0] if r.content else {}


def proximo_job() -> dict:
    rows = supa_get(
        "suprimentos_bot_jobs",
        {
            "status": "eq.pendente",
            "tipo": "eq.conferencia_dia",
            "order": "created_at.asc",
            "limit": 1,
        },
    )
    return rows[0] if rows else None


def lotes_pendentes_view() -> list:
    """Lotes com contagens lancadas mas sem job concluido / pendente.

    A view garante que o bot se auto-recupera quando o app nao consegue
    chamar o workflow_dispatch (rede ruim, token nao configurado, etc.):
    na proxima rodada agendada o bot detecta os lotes pendentes pela view
    e enfileira automaticamente.
    """
    try:
        return supa_get(
            "vw_suprimentos_lotes_pendentes",
            {
                "select": "lote_id,tipo_contagem,data_alvo,total_itens,ultimo_registro",
                "order": "ultimo_registro.asc",
                "limit": 50,
            },
        )
    except Exception as exc:
        print(f"[bot] falha ao consultar view de lotes pendentes: {exc}")
        return []


def enfileirar_lotes_da_view() -> int:
    """Para cada lote da view, cria um job pendente. Retorna quantidade criada."""
    lotes = lotes_pendentes_view()
    criados = 0
    for lote in lotes:
        try:
            supa_insert(
                "suprimentos_bot_jobs",
                {
                    "tipo": "conferencia_dia",
                    "tipo_contagem": lote.get("tipo_contagem") or "diaria",
                    "data_alvo": lote.get("data_alvo"),
                    "lote_id": lote.get("lote_id"),
                    "status": "pendente",
                    "criado_por_nome": "Bot (recuperacao via view)",
                },
            )
            criados += 1
        except Exception as exc:
            print(f"[bot] nao consegui enfileirar lote {lote.get('lote_id')}: {exc}")
    if criados:
        print(f"[bot] {criados} lote(s) pendente(s) enfileirado(s) a partir da view.")
    return criados


def buscar_job(job_id: str) -> dict:
    rows = supa_get(
        "suprimentos_bot_jobs",
        {
            "id": f"eq.{job_id}",
            "limit": 1,
        },
    )
    return rows[0] if rows else None


def marcar_processando(job_id: str):
    supa_patch(
        "suprimentos_bot_jobs",
        {"id": f"eq.{job_id}"},
        {"status": "processando", "iniciado_em": datetime.utcnow().isoformat() + "Z"},
    )


def marcar_concluido(job_id: str, resultado: dict):
    supa_patch(
        "suprimentos_bot_jobs",
        {"id": f"eq.{job_id}"},
        {
            "status": "concluido",
            "concluido_em": datetime.utcnow().isoformat() + "Z",
            "resultado_json": resultado,
            "erro": None,
        },
    )


def marcar_erro(job_id: str, msg: str):
    supa_patch(
        "suprimentos_bot_jobs",
        {"id": f"eq.{job_id}"},
        {
            "status": "erro",
            "concluido_em": datetime.utcnow().isoformat() + "Z",
            "erro": msg[:1000],
        },
    )


def carregar_contagens_do_dia(data_alvo: str) -> list:
    # Usa TZ -03:00 (Brasilia) pra alinhar com o dia "civil" no Brasil.
    # Sem isso, PostgREST trata as datas como UTC e mistura contagens de outros dias.
    inicio = f"{data_alvo}T00:00:00-03:00"
    fim = f"{data_alvo}T23:59:59.999-03:00"
    rows = supa_get(
        "suprimentos_contagens",
        {
            "select": "id,codigo,quantidade,saldo_erp,diferenca,lote_id,created_at",
            "created_at": f"gte.{inicio}",
            "and": f"(created_at.lte.{fim})",
            "order": "created_at.asc",
            "limit": "10000",
        },
    )
    return rows


def carregar_contagens_do_lote(lote_id: str) -> list:
    rows = supa_get(
        "suprimentos_contagens",
        {
            "select": "id,codigo,quantidade,saldo_erp,diferenca,lote_id,created_at",
            "lote_id": f"eq.{lote_id}",
            "order": "created_at.asc",
            "limit": "10000",
        },
    )
    return rows


def _log(step: str, msg: str = ""):
    print(f"[diaria] {step:>10}  {msg}", flush=True)


def _norm_codigo(raw) -> str:
    """Normaliza codigo: pega so digitos e remove zeros a esquerda.
    Assim '18180', '00000018180', '018180' viram todos '18180'.
    """
    digits = "".join(ch for ch in str(raw or "") if ch.isdigit())
    return digits.lstrip("0") or ""


def baixar_saldos_do_dia(data_alvo_iso: str) -> Dict[str, float]:
    d = datetime.strptime(data_alvo_iso, "%Y-%m-%d")
    ddmm = d.strftime("%d%m%Y")
    nome = f"saldo_{d.strftime('%Y%m%d')}.csv"
    _log("baixar", f"chamando TransNet para periodo {ddmm}->{ddmm}")
    arq = gerar_estoque_virtual_csv(ddmm, ddmm, nome)
    _log("baixar", f"CSV recebido: {arq}")
    df = tratar_estoque_virtual(arq)
    _log("baixar", f"linhas no CSV apos tratamento: {len(df)}")
    if "Saldo" not in df.columns:
        raise RuntimeError("CSV não trouxe coluna 'Saldo'.")

    saldos: Dict[str, float] = {}
    for _, row in df.iterrows():
        cod = _norm_codigo(row["Codigo da peça"])
        if not cod:
            continue
        saldo = float(row.get("Saldo", 0) or 0)
        saldos[cod] = saldo
    _log("baixar", f"codigos unicos com saldo: {len(saldos)}")
    if saldos:
        amostra = list(saldos.items())[:3]
        _log("baixar", f"amostra ERP: {amostra}")
    return saldos


def aplicar_resultado(contagens: list, saldos: Dict[str, float]) -> dict:
    atualizados = 0
    divergencias = 0
    sem_codigo_no_erp = 0

    for c in contagens:
        cod = _norm_codigo(c.get("codigo"))
        if not cod:
            continue
        qtd = float(c.get("quantidade") or 0)
        if cod not in saldos:
            sem_codigo_no_erp += 1
            _log("comparar", f"sem ERP: codigo={cod} (original={c.get('codigo')})")
            payload = {"saldo_erp": None, "diferenca": None}
        else:
            saldo = saldos[cod]
            diff = qtd - saldo
            if abs(diff) > 1e-6:
                divergencias += 1
            _log("comparar", f"codigo={cod} contado={qtd} ERP={saldo} diff={diff}")
            payload = {"saldo_erp": saldo, "diferenca": diff}
        supa_patch("suprimentos_contagens", {"id": f"eq.{c['id']}"}, payload)
        atualizados += 1

    return {
        "itens_atualizados": atualizados,
        "divergencias": divergencias,
        "sem_codigo_no_erp": sem_codigo_no_erp,
    }


def processar_job(job: dict):
    job_id = job["id"]
    data_alvo = job["data_alvo"]
    lote_id = job.get("lote_id")
    escopo = f"lote_id={lote_id}" if lote_id else f"dia_inteiro={data_alvo}"
    _log("STEP 1", f"job id={job_id}  data_alvo={data_alvo}  escopo={escopo}")
    marcar_processando(job_id)
    _log("STEP 2", "marcado como 'processando' no Supabase")

    if lote_id:
        contagens = carregar_contagens_do_lote(lote_id)
        # se o job tem lote_id mas data_alvo nao foi setado, descobre a partir da contagem
        if contagens and not data_alvo:
            data_alvo = contagens[0]["created_at"][:10]
    else:
        contagens = carregar_contagens_do_dia(data_alvo)
    _log("STEP 3", f"contagens nesse escopo: {len(contagens)}")
    if not contagens:
        marcar_concluido(job_id, {
            "itens_atualizados": 0,
            "divergencias": 0,
            "msg": "Sem contagens nesse lote." if lote_id else "Sem contagens nesse dia.",
            "lote_id": lote_id,
        })
        _log("STEP 3", "encerrando - nada pra processar.")
        return

    if not data_alvo:
        _log("ERRO ", "sem data_alvo definido — abortando.")
        marcar_erro(job_id, "data_alvo nao definido no job.")
        return

    _log("STEP 4", f"baixando saldo do ERP em {data_alvo}")
    saldos = baixar_saldos_do_dia(data_alvo)
    _log("STEP 5", f"comparando {len(contagens)} contagens x {len(saldos)} codigos no ERP")
    resultado = aplicar_resultado(contagens, saldos)
    resultado["codigos_unicos_no_erp"] = len(saldos)
    resultado["contagens_processadas"] = len(contagens)
    resultado["lote_id"] = lote_id
    resultado["escopo"] = escopo
    _log("STEP 6", "marcando job como 'concluido'")
    marcar_concluido(job_id, resultado)
    _log("STEP 7", f"OK: {resultado}")


def main():
    _log("main", "entrou em main()")
    parser = argparse.ArgumentParser()
    parser.add_argument("--loop", action="store_true")
    parser.add_argument("--interval", type=int, default=10)
    parser.add_argument("--max-jobs", type=int, default=10, help="Limite de jobs por execução (uso no Actions).")
    parser.add_argument(
        "--data-alvo",
        default="",
        help="Se informado, cria um job sintético para essa data (YYYY-MM-DD) e processa.",
    )
    parser.add_argument(
        "--job-id",
        default="",
        help="Se informado, processa exatamente este job da fila.",
    )
    args = parser.parse_args()

    if args.job_id:
        try:
            job = buscar_job(args.job_id)
            if not job:
                print(f"[bot] job_id={args.job_id} nao encontrado.")
                return
            processar_job(job)
        except Exception as e:
            traceback.print_exc()
            print(f"[bot] erro processando job_id={args.job_id}: {e}")
        return

    # Manual trigger via workflow_dispatch: cria o job na hora.
    if args.data_alvo:
        try:
            job = supa_insert(
                "suprimentos_bot_jobs",
                {
                    "tipo": "conferencia_dia",
                    "data_alvo": args.data_alvo,
                    "status": "pendente",
                    "criado_por_nome": "GitHub Actions",
                },
            )
            processar_job(job)
        except Exception as e:
            traceback.print_exc()
            print(f"[bot] erro no dispatch manual: {e}")
        return

    # Antes de comecar a varrer a fila, da uma olhada na view e enfileira
    # qualquer lote que ficou orfao (app finalizou mas o dispatch nao chegou).
    try:
        enfileirar_lotes_da_view()
    except Exception:
        traceback.print_exc()

    processados = 0
    while True:
        try:
            job = proximo_job()
            if job:
                try:
                    processar_job(job)
                except Exception as e:
                    msg = f"{type(e).__name__}: {e}"
                    traceback.print_exc()
                    marcar_erro(job["id"], msg)
                processados += 1
                if processados >= args.max_jobs:
                    print(f"[bot] limite de {args.max_jobs} jobs por execução atingido.")
                    return
            elif not args.loop:
                print("[bot] sem jobs pendentes.")
                return
        except Exception:
            traceback.print_exc()

        if not args.loop:
            return
        time.sleep(args.interval)


if __name__ == "__main__":
    main()
