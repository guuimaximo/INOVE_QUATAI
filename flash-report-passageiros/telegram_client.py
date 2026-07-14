"""Envio para o Telegram via Bot API (só requests, sem dependência extra)."""
from __future__ import annotations

from pathlib import Path

import requests

API = "https://api.telegram.org/bot{token}/{method}"


def _post(token: str, method: str, **kwargs) -> dict:
    r = requests.post(API.format(token=token, method=method), timeout=30, **kwargs)
    r.raise_for_status()
    data = r.json()
    if not data.get("ok"):
        raise RuntimeError(f"Telegram erro em {method}: {data}")
    return data


def enviar_texto(token: str, chat_id: str, texto: str) -> None:
    _post(token, "sendMessage", data={
        "chat_id": chat_id, "text": texto,
        "parse_mode": "HTML", "disable_web_page_preview": True,
    })


def enviar_foto(token: str, chat_id: str, foto: Path, legenda: str = "") -> None:
    with open(foto, "rb") as fh:
        _post(token, "sendPhoto",
              data={"chat_id": chat_id, "caption": legenda[:1024], "parse_mode": "HTML"},
              files={"photo": fh})
