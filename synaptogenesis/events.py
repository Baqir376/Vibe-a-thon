"""Append-only event stream (JSONL). The neural-map UI and the benchmark read this."""
from __future__ import annotations

import json
import time
from typing import Callable

from .config import STATE_DIR

EVENTS_FILE = STATE_DIR / "events.jsonl"
_listeners: list[Callable[[dict], None]] = []


def subscribe(fn: Callable[[dict], None]) -> None:
    _listeners.append(fn)


def emit(kind: str, **data) -> dict:
    ev = {"ts": time.time(), "kind": kind, **data}
    STATE_DIR.mkdir(exist_ok=True)
    with EVENTS_FILE.open("a", encoding="utf-8") as f:
        f.write(json.dumps(ev, default=str) + "\n")
    for fn in _listeners:
        try:
            fn(ev)
        except Exception:
            pass
    return ev
