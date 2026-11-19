"""Drift Sentinel: keeps the agent's picture of the company in sync with the code.

Watches every system's source. When a developer changes it, the Sentinel reruns
Synapse's scan (`synapse build --discover`), diffs the endpoint surface, and:
  - new endpoints become findable (and graftable) immediately,
  - removed endpoints are pulled from the agent if they were live,
  - for a new read-only endpoint without parameters, it smoke-tests a live call.
No restart, no manual MCP config edits.
"""
from __future__ import annotations

import asyncio
import time
from pathlib import Path
from typing import Callable

from .atlas import Atlas, scan_system
from .config import System
from .events import emit
from .graft import GraftManager

IGNORED = ("synapse_auto_server",)  # plus any *_server.py Synapse Custom output (see _fingerprint)


def _fingerprint(path: Path) -> dict[str, float]:
    fp = {}
    for f in path.rglob("*.py"):
        if any(part.startswith(".") or part == "__pycache__" for part in f.parts) or f.name.startswith(IGNORED) or f.name.endswith("_server.py"):
            continue
        try:
            fp[str(f)] = f.stat().st_mtime
        except OSError:
            pass
    return fp


class Sentinel:
    def __init__(self, systems: dict[str, System], atlas: Atlas, grafts: GraftManager,
                 on_drift: Callable[[dict], None] | None = None, interval: float = 1.0):
        self.systems = systems
        self.atlas = atlas
        self.grafts = grafts
        self.on_drift = on_drift or (lambda d: None)
        self.interval = interval
        self._prints = {name: _fingerprint(s.path) for name, s in systems.items() if s.mode != "fused"}

    async def run(self) -> None:
        emit("sentinel.watching", systems=list(self.systems))
        while True:
            await asyncio.sleep(self.interval)
            for name, s in list(self.systems.items()):
                if s.mode == "fused" or name not in self._prints:
                    continue
                fp = _fingerprint(s.path)
                if fp != self._prints[name]:
                    await asyncio.sleep(0.8)  # debounce editor saves
                    self._prints[name] = _fingerprint(s.path)
                    try:
                        await self.rescan(name)
                    except Exception as e:  # never let the watcher die
                        emit("drift.error", system=name, error=str(e)[:300])

    async def rescan(self, name: str) -> dict:
        s = self.systems[name]
        t0 = time.perf_counter()
        emit("drift.detected", system=name)
        caps = await asyncio.to_thread(scan_system, s)  # synapse build --discover
        added, removed = self.atlas.replace_system(name, caps)
        g = self.grafts.grafts.get(name)
        if g and removed:  # take vanished endpoints away from the agent
            gone = {c.tool for c in removed}
            g.exposed = {t: spec for t, spec in g.exposed.items() if t not in gone}
        result = {"system": name, "added": [c.spec for c in added], "removed": [c.spec for c in removed],
                  "rescan_ms": int((time.perf_counter() - t0) * 1000), "smoke": []}
        for c in added:
            if not c.mutating and not c.params:
                result["smoke"].append(await self._smoke(name, c.spec))
        emit("drift", **result)
        self.on_drift(result)
        return result

    async def _smoke(self, system: str, spec: str) -> dict:
        """Prove a new parameterless read endpoint works end to end through Synapse, then hide it again."""
        was_live = system in self.grafts.active_systems()
        try:
            await self.grafts.graft(system, [spec], "sentinel smoke test")
            cap = self.atlas.by_spec(system, spec)
            out, err = await self.grafts.call(f"{system}__{cap.tool}", {})
            ok = not err
        except Exception as e:
            out, ok = str(e), False
        g = self.grafts.grafts.get(system)
        if g and not was_live:
            g.exposed = {}
        elif g:
            g.exposed = {t: s for t, s in g.exposed.items() if s != spec}
        return {"endpoint": spec, "ok": ok, "sample": out[:120]}
