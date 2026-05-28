# bot/bot_semanal.py
# Auditoria semanal (Domingo→Domingo) com a fórmula do Excel.
# Fonte das contagens: tabela suprimentos_contagens do Supabase
# (contagens de domingo viradas no app).
# Saída: Excel salvo no bucket Storage 'suprimentos' (pasta auditorias/)
# + linha em suprimentos_auditorias com a URL.

from __future__ import annotations

import json
import os
import sys
from datetime import datetime, timedelta
from pathlib import Path
from typing import Dict

import pandas as pd
import requests
from openpyxl.utils import get_column_letter

sys.path.insert(0, str(Path(__file__).resolve().parent))
from transnet import (  # noqa: E402
    OUT_DIR,
    br_to_float,
    gerar_estoque_virtual_csv,
    tratar_estoque_virtual,
)

SUPABASE_URL = os.environ.get("SUPABASE_URL", "")
SUPABASE_KEY = os.environ.get("SUPABASE_SERVICE_KEY") or os.environ.get("SUPABASE_ANON_KEY", "")
if not SUPABASE_URL or not SUPABASE_KEY:
    print("[semanal] SUPABASE_URL/SUPABASE_SERVICE_KEY ausentes.")
    sys.exit(1)

HEADERS = {
    "apikey": SUPABASE_KEY,
    "Authorization": f"Bearer {SUPABASE_KEY}",
    "Content-Type": "application/json",
    "Prefer": "return=representation",
}

STORAGE_BUCKET = "suprimentos"
STORAGE_FOLDER = "auditorias"

TELEGRAM_TOKEN = os.environ.get("TELEGRAM_TOKEN", "")
TELEGRAM_CHAT_ID = os.environ.get("TELEGRAM_CHAT_ID", "")


def supa_get(path: str, params: dict = None) -> list:
    r = requests.get(f"{SUPABASE_URL}/rest/v1/{path}", headers=HEADERS, params=params or {}, timeout=60)
    r.raise_for_status()
    return r.json()


def supa_insert(path: str, payload: dict) -> dict:
    r = requests.post(f"{SUPABASE_URL}/rest/v1/{path}", headers=HEADERS, json=payload, timeout=60)
    r.raise_for_status()
    return r.json()[0] if r.content else {}


# ─── Carrega contagens dos 2 últimos domingos ───────────────
def carregar_contagens_supabase():
    rows = supa_get(
        "suprimentos_contagens",
        {
            "select": "codigo,quantidade,descricao,created_at",
            "order": "created_at.desc",
            "limit": "20000",
        },
    )
    if not rows:
        raise ValueError("Sem contagens em suprimentos_contagens.")
    df = pd.DataFrame(rows)
    df["created_at"] = pd.to_datetime(df["created_at"], utc=True).dt.tz_convert("America/Sao_Paulo")
    df["data"] = df["created_at"].dt.date
    df["dow"] = df["created_at"].dt.weekday  # 6 = domingo

    df_dom = df[df["dow"] == 6].copy()
    if df_dom["data"].nunique() < 2:
        raise ValueError("Precisamos de pelo menos 2 domingos com contagem no Supabase.")

    datas = sorted(df_dom["data"].unique())
    d1 = datas[-2]
    d2 = datas[-1]

    def somar(d):
        sub = df_dom[df_dom["data"] == d]
        s = sub.groupby("codigo")["quantidade"].sum()
        return {str(k).zfill(6): float(v) for k, v in s.items()}

    descr_map = {}
    for cod, desc in zip(df["codigo"], df["descricao"]):
        cod = str(cod or "").zfill(6)
        if cod and cod not in descr_map and isinstance(desc, str) and desc.strip():
            descr_map[cod] = desc.strip()

    return d1, somar(d1), d2, somar(d2), descr_map


# ─── Auditoria (fórmula do Excel) ───────────────────────────
def _norm(_df: pd.DataFrame):
    _df = _df.rename(columns={c: c.strip() for c in _df.columns}).copy()
    if "Qtd. Saída" not in _df.columns and "Qtd. Saida" in _df.columns:
        _df.rename(columns={"Qtd. Saida": "Qtd. Saída"}, inplace=True)
    for c in ["Qtd. Entrada", "Qtd. Saída", "Saldo", "Saldo Ant."]:
        if c in _df.columns and _df[c].dtype.kind not in "biufc":
            _df[c] = _df[c].map(br_to_float)
    key = "Codigo da peça" if "Codigo da peça" in _df.columns else "Codigo"
    _df[key] = _df[key].astype(str).str.extract(r"(\d+)")[0].fillna("").str.zfill(6)
    return _df, key


def _agg(ev: pd.DataFrame, k: str):
    if "Qtd. Entrada" not in ev.columns:
        ev["Qtd. Entrada"] = 0.0
    if "Qtd. Saída" not in ev.columns:
        ev["Qtd. Saída"] = 0.0
    g = ev.groupby(k, as_index=False).agg(ent=("Qtd. Entrada", "sum"), sai=("Qtd. Saída", "sum"))
    return g.rename(columns={k: "Codigo"})


def auditoria(C1, C2, EV1, EV2, EV3, descr_map):
    EV1, k1 = _norm(EV1)
    EV2, k2 = _norm(EV2)
    EV3, k3 = _norm(EV3)
    for df, k in [(EV1, k1), (EV2, k2), (EV3, k3)]:
        if "Descricao" in df.columns:
            tmp = df[[k, "Descricao"]].dropna()
            for cod, d in zip(tmp[k], tmp["Descricao"]):
                cod = str(cod).zfill(6)
                if cod and cod not in descr_map and isinstance(d, str) and d.strip():
                    descr_map[cod] = d.strip()

    a1, a2, a3 = _agg(EV1, k1), _agg(EV2, k2), _agg(EV3, k3)
    F7, F8 = dict(zip(a1["Codigo"], a1["ent"])), dict(zip(a1["Codigo"], a1["sai"]))
    J7, J8 = dict(zip(a2["Codigo"], a2["ent"])), dict(zip(a2["Codigo"], a2["sai"]))
    M7, M8 = dict(zip(a3["Codigo"], a3["ent"])), dict(zip(a3["Codigo"], a3["sai"]))

    F6 = {k: float(v) for k, v in C1.items()}
    codigos = set(C2.keys()) | set(F6.keys())

    rows = []
    for cod in sorted(codigos):
        b = float(F6.get(cod, 0))
        f7, f8 = float(F7.get(cod, 0)), float(F8.get(cod, 0))
        j7, j8 = float(J7.get(cod, 0)), float(J8.get(cod, 0))
        m7, m8 = float(M7.get(cod, 0)), float(M8.get(cod, 0))
        has_c2 = cod in C2
        c2v = float(C2.get(cod, 0)) if has_c2 else None
        maximo = b + f7 - j8 + j7 + m7
        minimo = max(0.0, b - f8) - j8 + j7 - m8
        status = "SEM CONTAGEM" if not has_c2 else ("CORRETO" if minimo <= c2v <= maximo else "ERRADO")
        rows.append({
            "Codigo": cod, "Descricao": descr_map.get(cod, ""),
            "C1": b, "EV1_Entrada": f7, "EV1_Saida": f8,
            "EV2_Entrada": j7, "EV2_Saida": j8,
            "EV3_Entrada": m7, "EV3_Saida": m8,
            "Minimo": minimo, "Maximo": maximo, "C2": c2v, "Status": status,
        })
    return pd.DataFrame(rows).sort_values(["Status", "Codigo"])


def salvar_excel(df_aud: pd.DataFrame, resumo: dict, path_xlsx: Path):
    with pd.ExcelWriter(path_xlsx, engine="openpyxl") as writer:
        pd.DataFrame([resumo]).to_excel(writer, sheet_name="Resumo", index=False)
        df_aud.to_excel(writer, sheet_name="Itens", index=False, freeze_panes=(1, 1))
        wb = writer.book
        for ws in (wb["Resumo"], wb["Itens"]):
            for idx, col_cells in enumerate(ws.columns, 1):
                m = max((len(str(c.value or "")) for c in col_cells), default=8)
                ws.column_dimensions[get_column_letter(idx)].width = min(m + 2, 60)


# ─── Upload pro Supabase Storage ────────────────────────────
def upload_excel(path: Path, dest_name: str) -> str:
    url = f"{SUPABASE_URL}/storage/v1/object/{STORAGE_BUCKET}/{STORAGE_FOLDER}/{dest_name}"
    headers = {
        "apikey": SUPABASE_KEY,
        "Authorization": f"Bearer {SUPABASE_KEY}",
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "x-upsert": "true",
    }
    with open(path, "rb") as f:
        r = requests.post(url, headers=headers, data=f.read(), timeout=120)
    if r.status_code not in (200, 201):
        raise RuntimeError(f"Upload falhou ({r.status_code}): {r.text}")
    return f"{SUPABASE_URL}/storage/v1/object/public/{STORAGE_BUCKET}/{STORAGE_FOLDER}/{dest_name}"


# ─── Telegram (opcional) ────────────────────────────────────
def enviar_telegram(texto: str):
    if not TELEGRAM_TOKEN or not TELEGRAM_CHAT_ID:
        return
    try:
        requests.post(
            f"https://api.telegram.org/bot{TELEGRAM_TOKEN}/sendMessage",
            data={"chat_id": TELEGRAM_CHAT_ID, "text": texto, "parse_mode": "Markdown"},
            timeout=30,
        )
    except Exception as e:
        print(f"[telegram] {e}")


def main():
    print("[semanal] carregando contagens do Supabase...")
    d1, C1, d2, C2, descr_map = carregar_contagens_supabase()
    print(f"[semanal] d1={d1}  d2={d2}  itens_d1={len(C1)}  itens_d2={len(C2)}")

    d1_dt = datetime.combine(d1, datetime.min.time())
    d2_dt = datetime.combine(d2, datetime.min.time())
    ev1_ini = d1_dt - timedelta(days=2)
    ev1_fim = d1_dt + timedelta(days=1)
    ev2_ini = d1_dt + timedelta(days=2)
    ev2_fim = d1_dt + timedelta(days=4)
    ev3_ini = d2_dt - timedelta(days=2)
    ev3_fim = d2_dt + timedelta(days=1)

    def fmt(d): return d.strftime("%d%m%Y")
    print("[semanal] baixando CSVs do TransNet...")
    arq1 = gerar_estoque_virtual_csv(fmt(ev1_ini), fmt(ev1_fim), "Estoque_virtual_1.csv")
    arq2 = gerar_estoque_virtual_csv(fmt(ev2_ini), fmt(ev2_fim), "Estoque_virtual_2.csv")
    arq3 = gerar_estoque_virtual_csv(fmt(ev3_ini), fmt(ev3_fim), "Estoque_virtual_3.csv")
    df1 = tratar_estoque_virtual(arq1)
    df2 = tratar_estoque_virtual(arq2)
    df3 = tratar_estoque_virtual(arq3)

    df_aud = auditoria(C1, C2, df1, df2, df3, descr_map)
    total = len(df_aud)
    n_ok = int((df_aud["Status"] == "CORRETO").sum())
    n_err = int((df_aud["Status"] == "ERRADO").sum())
    n_sem = int((df_aud["Status"] == "SEM CONTAGEM").sum())

    resumo = {
        "domingo_1": str(d1), "domingo_2": str(d2),
        "itens_total": total, "itens_corretos": n_ok,
        "itens_errados": n_err, "itens_sem_contagem": n_sem,
        "formula": "Max=F6+F7−J8+J7+M7 | Min=max(0,F6−F8)−J8+J7−M8",
    }

    xlsx_local = OUT_DIR / "auditoria_por_item.xlsx"
    salvar_excel(df_aud, resumo, xlsx_local)

    dest_name = f"semanal_{d2.strftime('%Y%m%d')}.xlsx"
    excel_url = upload_excel(xlsx_local, dest_name)
    print(f"[semanal] Excel disponível em {excel_url}")

    auditoria_row = supa_insert(
        "suprimentos_auditorias",
        {
            "tipo": "semanal",
            "data_inicio": str(d1),
            "data_fim": str(d2),
            "resumo_json": resumo,
            "excel_url": excel_url,
            "criado_por_nome": "GitHub Actions (semanal)",
        },
    )
    print(f"[semanal] auditoria registrada id={auditoria_row.get('id')}")

    enviar_telegram(
        f"🧮 *Auditoria Semanal*\n📆 {d1} → {d2}\n"
        f"🗂️ Total: *{total}* | ✅ {n_ok} | ❌ {n_err} | ⛳ Sem contagem: {n_sem}\n"
        f"📎 {excel_url}"
    )


if __name__ == "__main__":
    main()
