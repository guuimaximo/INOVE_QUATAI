# -*- coding: utf-8 -*-
"""Conexão Supabase para o projeto PREVENTIVAS.

Lê as credenciais do arquivo .env (nunca hardcode no código).
Uso:
    from conexao import fetch_all, SB_A, SB_B
    planos = fetch_all(SB_A, "ultimo_plano", "nr_ordem,ds_plano,km_para_proxima")

Teste rápido:  python conexao.py
"""
import os
from pathlib import Path

import requests

# ---- carrega .env (parser simples, sem dependência externa) ----
_ENV_PATH = Path(__file__).resolve().parent / ".env"
if _ENV_PATH.exists():
    for _line in _ENV_PATH.read_text(encoding="utf-8").splitlines():
        _line = _line.strip()
        if not _line or _line.startswith("#") or "=" not in _line:
            continue
        _k, _v = _line.split("=", 1)
        os.environ.setdefault(_k.strip(), _v.strip())


def _need(name: str) -> str:
    v = os.getenv(name)
    if not v:
        raise RuntimeError(f"Variável {name} ausente — confira o .env em {_ENV_PATH}")
    return v


# ---- endpoints ----
class _Base:
    def __init__(self, url: str, key: str, apelido: str):
        self.url = url.rstrip("/")
        self.key = key
        self.apelido = apelido

    @property
    def headers(self):
        return {"apikey": self.key, "Authorization": f"Bearer {self.key}"}


SB_A = _Base(_need("SUPABASE_A_URL"), _need("SUPABASE_A_SERVICE_ROLE_KEY"), "TRANSNET")
SB_B = _Base(_need("SUPABASE_B_URL"), _need("SUPABASE_B_SERVICE_ROLE_KEY"), "INOVE")


def fetch_all(base: _Base, table: str, select: str = "*", extra_qs: str = "", page: int = 1000):
    """Lê uma tabela inteira via PostgREST, paginando. Retorna list[dict].

    extra_qs: filtros PostgREST extras, ex: "&cs_ativo=neq.N&order=nr_ordem.asc"
    """
    out, offset = [], 0
    while True:
        url = f"{base.url}/rest/v1/{table}?select={select}{extra_qs}"
        r = requests.get(url, headers={**base.headers, "Range": f"{offset}-{offset + page - 1}"}, timeout=60)
        r.raise_for_status()
        rows = r.json()
        out.extend(rows)
        if len(rows) < page:
            break
        offset += page
    return out


if __name__ == "__main__":
    for base in (SB_A, SB_B):
        try:
            r = requests.get(f"{base.url}/rest/v1/", headers=base.headers, timeout=30)
            print(f"[OK] {base.apelido:8s} {base.url} -> HTTP {r.status_code}")
        except Exception as e:
            print(f"[ERRO] {base.apelido}: {e}")
    # amostra rápida da tabela de planos
    try:
        planos = fetch_all(SB_A, "ultimo_plano", "nr_ordem,ds_plano,km_para_proxima,cs_ativo", "&limit=3")
        print(f"[OK] ultimo_plano acessível — amostra: {planos[:2]}")
    except Exception as e:
        print(f"[ERRO] ultimo_plano: {e}")
