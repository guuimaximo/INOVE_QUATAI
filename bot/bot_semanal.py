# bot/bot_semanal.py
# Auditoria semanal (Domingo→Domingo) com a fórmula do Excel.
# Roda no GitHub Actions com cron Mon 06:00 UTC (≈ 03:00 BRT).
# Pega C1/C2 do Google Sheets (mesma planilha de hoje) e EV1/EV2/EV3 do TransNet,
# gera o Excel e manda no Telegram.

from __future__ import annotations

import json
import os
import sys
from datetime import datetime, timedelta
from pathlib import Path
from typing import Dict, Optional, Set, Tuple

import pandas as pd
import requests
import gspread
from oauth2client.service_account import ServiceAccountCredentials
from openpyxl.utils import get_column_letter

sys.path.insert(0, str(Path(__file__).resolve().parent))
from transnet import (  # noqa: E402
    OUT_DIR,
    br_to_float,
    gerar_estoque_virtual_csv,
    tratar_estoque_virtual,
)

BASE_DIR = Path(__file__).resolve().parent

SHEET_REF = os.environ.get(
    "SHEET_REF",
    "https://docs.google.com/spreadsheets/d/1aFvKKbeRg99ofI1JqEFNnmzxwx_rzGVqD7ONjnCWKf4/edit?usp=sharing",
)
SHEET_TAB = os.environ.get("SHEET_TAB", "Contagem")
COL_DATA = "data"
COL_QTD = "QUANTIDADE"
COL_ITEM = "Codigo da peça"

CRED_JSON_PATH = os.environ.get("GOOGLE_CREDENTIALS_PATH", str(BASE_DIR / "credenciais.json"))

TELEGRAM_TOKEN = os.environ.get("TELEGRAM_TOKEN", "")
TELEGRAM_CHAT_ID = os.environ.get("TELEGRAM_CHAT_ID", "")

GSCOPE = ["https://spreadsheets.google.com/feeds", "https://www.googleapis.com/auth/drive"]


def _sheet_key(ref: str) -> str:
    if "/d/" in ref:
        try:
            return ref.split("/d/")[1].split("/")[0]
        except Exception:
            pass
    return ref


SHEET_KEY = _sheet_key(SHEET_REF)


# ─── Telegram ────────────────────────────────────────────────
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


def enviar_telegram_arquivo(path: Path, caption: str = ""):
    if not TELEGRAM_TOKEN or not TELEGRAM_CHAT_ID:
        return
    try:
        with open(path, "rb") as f:
            requests.post(
                f"https://api.telegram.org/bot{TELEGRAM_TOKEN}/sendDocument",
                files={"document": (path.name, f)},
                data={"chat_id": TELEGRAM_CHAT_ID, "caption": caption, "parse_mode": "Markdown"},
                timeout=120,
            )
    except Exception as e:
        print(f"[telegram-arquivo] {e}")


# ─── Sheets ──────────────────────────────────────────────────
def auth_gspread():
    if not Path(CRED_JSON_PATH).exists():
        raise FileNotFoundError(f"Credencial Google não encontrada em {CRED_JSON_PATH}")
    creds = ServiceAccountCredentials.from_json_keyfile_name(CRED_JSON_PATH, GSCOPE)
    return gspread.authorize(creds)


def carregar_contagens_ultimos_domingos(gc):
    ws = gc.open_by_key(SHEET_KEY).worksheet(SHEET_TAB)
    df = pd.DataFrame(ws.get_all_records())
    if df.empty:
        raise ValueError("Aba 'Contagem' vazia.")
    df.rename(columns={c: c.strip() for c in df.columns}, inplace=True)

    if COL_DATA not in df.columns or COL_QTD not in df.columns:
        raise ValueError(f"Colunas esperadas não encontradas: '{COL_DATA}', '{COL_QTD}'.")

    sheet_desc_col = None
    for c in ["Descricao", "Descrição", "Produto", "Nome", "DESCRICAO"]:
        if c in df.columns:
            sheet_desc_col = c
            break

    item_col = COL_ITEM if COL_ITEM in df.columns else ("Codigo" if "Codigo" in df.columns else None)
    if not item_col:
        raise ValueError("Coluna do item não encontrada.")

    df[COL_DATA] = pd.to_datetime(df[COL_DATA], dayfirst=True, errors="coerce")
    df = df.dropna(subset=[COL_DATA])
    df_dom = df[df[COL_DATA].dt.weekday == 6].copy()
    if df_dom.empty or df_dom[COL_DATA].nunique() < 2:
        raise ValueError("Precisamos de pelo menos 2 domingos na planilha.")

    datas_dom = sorted(df_dom[COL_DATA].unique())
    d1 = pd.to_datetime(datas_dom[-2]).to_pydatetime()
    d2 = pd.to_datetime(datas_dom[-1]).to_pydatetime()

    df1 = df_dom[df_dom[COL_DATA] == d1]
    df2 = df_dom[df_dom[COL_DATA] == d2]
    c1 = df1.groupby(item_col)[COL_QTD].sum().astype(float)
    c2 = df2.groupby(item_col)[COL_QTD].sum().astype(float)

    C1_map = {str(k).zfill(6): float(v) for k, v in c1.items()}
    C2_map = {str(k).zfill(6): float(v) for k, v in c2.items()}

    sheet_descr_map = {}
    if sheet_desc_col:
        tmp = df2[[item_col, sheet_desc_col]].dropna()
        for cod, desc in zip(tmp[item_col], tmp[sheet_desc_col]):
            cod = str(cod).zfill(6)
            if cod and isinstance(desc, str) and desc.strip():
                sheet_descr_map[cod] = desc.strip()

    return item_col, d1, C1_map, d2, C2_map, sheet_descr_map


# ─── Base de itens ───────────────────────────────────────────
def carregar_base_itens() -> Tuple[Set[str], Dict[str, str], Optional[Path]]:
    candidatos = list(BASE_DIR.glob("*.xlsx")) + list(OUT_DIR.glob("*.xlsx"))
    candidatos = [p for p in candidatos if p.name.lower() != "auditoria_por_item.xlsx"]
    if not candidatos:
        return set(), {}, None

    col_cods = ["codigo da peça", "codigo", "código", "cod"]
    col_desc = ["descricao", "descrição", "produto", "nome", "item"]

    for arq in candidatos:
        try:
            df = pd.read_excel(arq, dtype=str)
            df.rename(columns={c: c.strip() for c in df.columns}, inplace=True)
            low = {c.lower(): c for c in df.columns}
            cod_col = next((low[c] for c in col_cods if c in low), None)
            if not cod_col:
                continue
            df[cod_col] = df[cod_col].astype(str).str.extract(r"(\d+)")[0].fillna("").str.zfill(6)
            cods = set(df[cod_col].dropna())
            dmap = {}
            for d in col_desc:
                if d in low:
                    tmp = df[[cod_col, low[d]]].dropna()
                    for k, v in zip(tmp[cod_col], tmp[low[d]]):
                        if k and isinstance(v, str) and v.strip():
                            dmap[k] = v.strip()
                    break
            if cods:
                return cods, dmap, arq
        except Exception:
            continue
    return set(), {}, None


# ─── Auditoria ───────────────────────────────────────────────
def _norm_cols(_df: pd.DataFrame):
    _df = _df.rename(columns={c: c.strip() for c in _df.columns}).copy()
    if "Qtd. Saída" not in _df.columns and "Qtd. Saida" in _df.columns:
        _df.rename(columns={"Qtd. Saida": "Qtd. Saída"}, inplace=True)
    for c in ["Qtd. Entrada", "Qtd. Saída", "Saldo", "Saldo Ant."]:
        if c in _df.columns:
            if _df[c].dtype.kind in "biufc":
                _df[c] = _df[c].astype(float)
            else:
                _df[c] = _df[c].map(br_to_float)
    key = "Codigo da peça" if "Codigo da peça" in _df.columns else "Codigo"
    _df[key] = _df[key].astype(str).str.extract(r"(\d+)")[0].fillna("").str.zfill(6)
    return _df, key


def _sum_ev(ev: pd.DataFrame, k: str):
    if "Qtd. Entrada" not in ev.columns:
        ev["Qtd. Entrada"] = 0.0
    if "Qtd. Saída" not in ev.columns:
        ev["Qtd. Saída"] = 0.0
    g = ev.groupby(k, as_index=False).agg(ent=("Qtd. Entrada", "sum"), sai=("Qtd. Saída", "sum"))
    return g.rename(columns={k: "Codigo"})


def auditoria(C1, C2, EV1, EV2, EV3, base_descr_map=None, sheet_descr_map=None, required_codes=None):
    EV1, c1 = _norm_cols(EV1)
    EV2, c2 = _norm_cols(EV2)
    EV3, c3 = _norm_cols(EV3)

    descr_map: Dict[str, str] = {}
    for df, k in [(EV1, c1), (EV2, c2), (EV3, c3)]:
        if "Descricao" in df.columns:
            tmp = df[[k, "Descricao"]].dropna()
            for cod, d in zip(tmp[k], tmp["Descricao"]):
                cod = str(cod).zfill(6)
                if cod and cod not in descr_map and isinstance(d, str) and d.strip():
                    descr_map[cod] = d.strip()
    for src in (base_descr_map or {}, sheet_descr_map or {}):
        for k, v in src.items():
            descr_map.setdefault(k, v)

    s1 = _sum_ev(EV1, c1)
    s2 = _sum_ev(EV2, c2)
    s3 = _sum_ev(EV3, c3)
    F7 = dict(zip(s1["Codigo"], s1["ent"]))
    F8 = dict(zip(s1["Codigo"], s1["sai"]))
    J7 = dict(zip(s2["Codigo"], s2["ent"]))
    J8 = dict(zip(s2["Codigo"], s2["sai"]))
    M7 = dict(zip(s3["Codigo"], s3["ent"]))
    M8 = dict(zip(s3["Codigo"], s3["sai"]))

    F6 = {k: float(v) for k, v in C1.items()}
    codigos = set(required_codes) if required_codes else set(C2.keys())

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


def salvar_excel(df_aud, resumo, path_xlsx: Path):
    with pd.ExcelWriter(path_xlsx, engine="openpyxl") as writer:
        pd.DataFrame([resumo]).to_excel(writer, sheet_name="Resumo", index=False)
        df_aud.to_excel(writer, sheet_name="Itens", index=False, freeze_panes=(1, 1))
        wb = writer.book
        for ws in (wb["Resumo"], wb["Itens"]):
            for idx, col_cells in enumerate(ws.columns, 1):
                m = max((len(str(c.value or "")) for c in col_cells), default=8)
                ws.column_dimensions[get_column_letter(idx)].width = min(m + 2, 60)


def main():
    enviar_telegram("🚀 *Auditoria semanal iniciando (GitHub Actions)*")
    required_codes, base_descr_map, base_file = carregar_base_itens()

    gc = auth_gspread()
    _, d1, C1, d2, C2, sheet_descr_map = carregar_contagens_ultimos_domingos(gc)
    print(f"[planilha] d1={d1:%d/%m/%Y}  d2={d2:%d/%m/%Y}")

    ev1_ini = d1 - timedelta(days=2)
    ev1_fim = d1 + timedelta(days=1)
    ev2_ini = d1 + timedelta(days=2)
    ev2_fim = d1 + timedelta(days=4)
    ev3_ini = d2 - timedelta(days=2)
    ev3_fim = d2 + timedelta(days=1)

    def fmt(d): return d.strftime("%d%m%Y")
    arq1 = gerar_estoque_virtual_csv(fmt(ev1_ini), fmt(ev1_fim), "Estoque_virtual_1.csv")
    arq2 = gerar_estoque_virtual_csv(fmt(ev2_ini), fmt(ev2_fim), "Estoque_virtual_2.csv")
    arq3 = gerar_estoque_virtual_csv(fmt(ev3_ini), fmt(ev3_fim), "Estoque_virtual_3.csv")

    df1 = tratar_estoque_virtual(arq1)
    df2 = tratar_estoque_virtual(arq2)
    df3 = tratar_estoque_virtual(arq3)

    df_aud = auditoria(C1, C2, df1, df2, df3,
                       base_descr_map=base_descr_map,
                       sheet_descr_map=sheet_descr_map,
                       required_codes=required_codes if required_codes else None)

    total = len(df_aud)
    n_ok = int((df_aud["Status"] == "CORRETO").sum())
    n_err = int((df_aud["Status"] == "ERRADO").sum())
    n_sem = int((df_aud["Status"] == "SEM CONTAGEM").sum())
    resumo = {
        "domingo_1": d1.strftime("%d/%m/%Y"),
        "domingo_2": d2.strftime("%d/%m/%Y"),
        "itens_total": total, "itens_corretos": n_ok,
        "itens_errados": n_err, "itens_sem_contagem": n_sem,
        "formula": "Max=F6+F7−J8+J7+M7 | Min=max(0,F6−F8)−J8+J7−M8",
        "base": "C1 (contagem 1º domingo)",
        "lista_base": base_file.name if base_file else "",
    }

    xlsx_path = OUT_DIR / "auditoria_por_item.xlsx"
    salvar_excel(df_aud, resumo, xlsx_path)

    meta = {
        "EV1": {"ini": fmt(ev1_ini), "fim": fmt(ev1_fim)},
        "EV2": {"ini": fmt(ev2_ini), "fim": fmt(ev2_fim)},
        "EV3": {"ini": fmt(ev3_ini), "fim": fmt(ev3_fim)},
        "resumo": resumo,
    }
    (OUT_DIR / "intervalos_e_auditoria.json").write_text(json.dumps(meta, ensure_ascii=False, indent=2), encoding="utf-8")

    msg = (
        "🧮 *Auditoria Semanal*\n"
        f"📆 {d1:%d/%m/%Y} → {d2:%d/%m/%Y}\n"
        f"🗂️ Total: *{total}* | ✅ {n_ok} | ❌ {n_err} | ⛳ Sem contagem: {n_sem}"
    )
    enviar_telegram(msg)
    enviar_telegram_arquivo(xlsx_path, caption="📎 *Auditoria por Item*")
    print("[ok] auditoria gerada.")


if __name__ == "__main__":
    main()
