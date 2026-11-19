"""Tool fusion: "neurons that fire together wire together".

1. Learn  - after every question, record the chain of calls the agent made per system.
            A chain that includes a data-changing step, seen FUSE_THRESHOLD times, is a fusion candidate.
2. Fuse   - Synapse Custom mode composes ONE tool from the system's internal Python functions,
            described from what the agent actually did (synapse build --custom -q "...").
3. Verify - before any agent may use it, the composed tool runs in a sandbox copy of the service:
            the agent's own call is replayed and must succeed; an identical second call must be
            refused (no double side effects); the result must be valid JSON.
4. Wire   - only a verified tool joins the atlas, as a new system "<system>_fused".
            Using it still needs human approval like any data-changing action.
"""
from __future__ import annotations

import asyncio
import json
import os
import shutil
import sys
import tempfile
import time
from pathlib import Path

from mcp import ClientSession
from mcp.client.stdio import StdioServerParameters, stdio_client

from . import synapse_cli
from .atlas import Atlas, Capability
from .config import STATE_DIR, System
from .events import emit

FUSED_DIR = STATE_DIR / "fused"
REGISTRY = STATE_DIR / "fused.json"
HEBBIAN = STATE_DIR / "hebbian.json"
FUSE_THRESHOLD = int(os.environ.get("SYNAPTO_FUSE_THRESHOLD", "2"))


def _read(path: Path, default):
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except (OSError, ValueError):
        return default


def _write(path: Path, data) -> None:
    STATE_DIR.mkdir(exist_ok=True)
    path.write_text(json.dumps(data, indent=1), encoding="utf-8")


def fused_system(base: System) -> System:
    return System(name=f"{base.name}_fused", path=base.path, base_url=base.base_url, mode="fused",
                  description=f"Verified one-step workflow tools composed by Synapse Custom mode from {base.name}'s internal functions.")


def load_into(systems: dict[str, System], atlas: Atlas) -> None:
    """Add previously verified fused tools to the live system registry and atlas."""
    for base_name, tools in _read(REGISTRY, {}).items():
        if base_name not in systems:
            continue
        fs = fused_system(systems[base_name])
        systems[fs.name] = fs
        for t in tools.values():  # the old write steps are superseded by the verified workflow
            for step in t.get("chain", []):
                cap = atlas.lookup(base_name, step)
                if cap and cap.mutating:
                    atlas.superseded.add((base_name, step))
        def describe(t: dict) -> str:
            # The sandbox verification proved one call works; show it so agents use valid values.
            example = (t.get("verified") or {}).get("replay_args")
            return t["description"] + (f" Verified example call: {json.dumps(example)}" if example else "")
        atlas.caps = [c for c in atlas.caps if c.system != fs.name] + [
            Capability(fs.name, name, "POST", f"/fused/{name}", describe(t), t["params"]) for name, t in tools.items()]


def server_file(system: str, tool: str) -> str | None:
    base = system[: -len("_fused")] if system.endswith("_fused") else system
    t = _read(REGISTRY, {}).get(base, {}).get(tool)
    return t["file"] if t else None


class Fusion:
    def __init__(self, systems: dict[str, System], atlas: Atlas):
        self.systems = systems
        self.atlas = atlas
        self.busy: set[str] = set()

    # -------------------------------------------------------------- learn
    def observe(self, trace: list[dict]) -> list[dict]:
        """Record per-system chains from one answered question; return chains ready to fuse."""
        chains: dict[str, list[dict]] = {}
        for step in trace:
            system, _, tool = step["tool"].partition("__")
            if not tool or step.get("is_error") or system not in self.systems or self.systems[system].mode == "fused":
                continue
            chain = chains.setdefault(system, [])
            if not chain or chain[-1]["tool"] != tool:
                chain.append({"tool": tool, "input": step.get("input") or {}})
        counts = _read(HEBBIAN, {})
        fused = _read(REGISTRY, {})
        ready = []
        for system, chain in chains.items():
            caps = [self.atlas.lookup(system, c["tool"]) for c in chain]
            if len(chain) < 2 or not any(c and c.mutating for c in caps):
                continue
            key = f"{system}:" + ">".join(c["tool"] for c in chain)
            counts[key] = counts.get(key, 0) + 1
            emit("fusion.observed", system=system, chain=[c["tool"] for c in chain], count=counts[key],
                 threshold=FUSE_THRESHOLD)
            already = any(set(t.get("chain", [])) == {c["tool"] for c in chain} for t in fused.get(system, {}).values())
            if counts[key] >= FUSE_THRESHOLD and not already and self.systems[system].path.joinpath("main.py").exists():
                ready.append({"system": system, "chain": chain})
        _write(HEBBIAN, counts)
        return ready

    # -------------------------------------------------------------- fuse + verify + wire
    async def fuse(self, system: str, chain: list[dict]) -> dict:
        if system in self.busy:
            return {"system": system, "skipped": "fusion already running"}
        self.busy.add(system)
        try:
            return await self._fuse(system, chain)
        finally:
            self.busy.discard(system)

    async def _fuse(self, system: str, chain: list[dict]) -> dict:
        base = self.systems[system]
        steps = []
        for c in chain:
            cap = self.atlas.lookup(system, c["tool"])
            steps.append(f"{c['tool']} ({cap.description})" if cap and cap.description else c["tool"])
        query = ("Compose ONE tool that performs this complete workflow in a single call, using the project's "
                 "internal functions, with the same checks and the same result: " + " ; then ".join(steps) +
                 ". Return the created record on success and a clear error dict on refusal.")
        emit("fusion.start", system=system, chain=[c["tool"] for c in chain], query=query)
        t0 = time.perf_counter()
        # Synapse scans every .py in the repo, including its own earlier outputs: park those so the
        # composed tool can only depend on the real code.
        parked = STATE_DIR / "parked"
        parked.mkdir(parents=True, exist_ok=True)
        for stray in list(base.path.glob("*_server.py")) + list(base.path.glob("synapse_auto_server*.py")):
            shutil.move(str(stray), parked / f"{system}__{stray.name}")
        run = await asyncio.to_thread(synapse_cli.run, ["build", "--custom", "--local", "--yes", "-q", query],
                                      base.path, synapse_cli.fusion_env())
        out = synapse_cli.parse_output_file(run.stdout)
        if not run.ok or not out:
            err = synapse_cli.short_error(run.stdout)
            emit("fusion.failed", system=system, stage="synapse", error=err)
            return {"system": system, "error": f"Synapse Custom build failed: {err}"}
        src = Path(out) if Path(out).is_absolute() else base.path / out
        tool_name = src.stem[: -len("_server")] if src.stem.endswith("_server") else src.stem
        FUSED_DIR.mkdir(parents=True, exist_ok=True)
        dest = FUSED_DIR / f"{system}__{tool_name}.py"
        shutil.move(str(src), dest)  # keep the legacy repo untouched
        build_ms = run.elapsed_ms
        emit("fusion.built", system=system, tool=tool_name, build_ms=build_ms)

        report = await self.verify(base, dest, chain)
        emit("fusion.verified" if report["ok"] else "fusion.failed", system=system, tool=tool_name,
             stage="verify", report=report)
        if not report["ok"]:
            dest.unlink(missing_ok=True)
            return {"system": system, "tool": tool_name, "error": "verification failed", "report": report}

        registry = _read(REGISTRY, {})
        registry.setdefault(system, {})[report["tool"]] = {
            "file": str(dest), "description": report["description"], "params": report["params"],
            "chain": [c["tool"] for c in chain], "verified": report, "query": query,
            "built_at": time.time(), "build_ms": build_ms}
        _write(REGISTRY, registry)
        load_into(self.systems, self.atlas)
        emit("fusion.wired", system=f"{system}_fused", tool=report["tool"], chain=[c["tool"] for c in chain],
             total_ms=int((time.perf_counter() - t0) * 1000))
        return {"system": f"{system}_fused", "tool": report["tool"], "ok": True, "report": report}

    async def verify(self, base: System, file: Path, chain: list[dict]) -> dict:
        """Run the composed tool against a throwaway copy of the service code (no shared data)."""
        sandbox = Path(tempfile.mkdtemp(prefix="synapto-fuse-"))
        for f in base.path.glob("*.py"):  # real source only: a tool that needs a generated file must fail here
            if not (f.name.startswith("synapse_auto_server") or f.name.endswith("_server.py")):
                shutil.copy2(f, sandbox / f.name)
        server = sandbox / file.name
        shutil.copy2(file, server)
        env = {**os.environ, "PYTHONPATH": str(sandbox)}
        env.pop("REFUND_LEDGER", None)
        params = StdioServerParameters(command=sys.executable, args=[str(server)], env=env, cwd=str(sandbox))
        report: dict = {"ok": False, "checks": []}
        try:
            async with stdio_client(params, errlog=open(os.devnull, "w")) as (r, w):
                async with ClientSession(r, w) as s:
                    await s.initialize()
                    tools = (await s.list_tools()).tools
                    if len(tools) != 1:
                        report["checks"].append({"check": "exactly one tool", "ok": False, "got": len(tools)})
                        return report
                    t = tools[0]
                    props = (t.inputSchema or {}).get("properties", {})
                    report.update(tool=t.name, description=t.description or t.name, params=list(props))
                    report["checks"].append({"check": "exactly one tool", "ok": True})
                    # Replay the agent's own inputs (matched by parameter name).
                    seen = {}
                    for c in chain:
                        seen.update(c["input"])
                    missing = [p for p in (t.inputSchema or {}).get("required", []) if p not in seen]
                    if missing:
                        report["checks"].append({"check": "replay inputs available", "ok": False, "missing": missing})
                        return report
                    args = {p: seen[p] for p in props if p in seen}
                    first = await s.call_tool(t.name, args)
                    r1 = _result(first)
                    ok1 = not first.isError and isinstance(r1, dict) and not r1.get("error")
                    report["checks"].append({"check": "replayed call succeeds", "ok": ok1, "result": _short(r1)})
                    second = await s.call_tool(t.name, args)
                    r2 = _result(second)
                    ok2 = second.isError or (isinstance(r2, dict) and bool(r2.get("error")))
                    report["checks"].append({"check": "identical call refused (no double side effect)", "ok": ok2,
                                             "result": _short(r2)})
                    report["ok"] = ok1 and ok2
                    report["replay_args"] = args
                    return report
        except Exception as e:
            report["checks"].append({"check": "tool starts", "ok": False, "error": f"{type(e).__name__}: {e}"[:300]})
            return report
        finally:
            shutil.rmtree(sandbox, ignore_errors=True)


def _result(res) -> object:
    texts = [getattr(c, "text", "") for c in res.content]
    try:
        return json.loads(texts[0]) if len(texts) == 1 else [json.loads(t) for t in texts]
    except (ValueError, IndexError):
        return {"error": " ".join(texts)[:300]} if res.isError else " ".join(texts)[:300]


def _short(v) -> object:
    s = json.dumps(v, default=str)
    return v if len(s) <= 400 else s[:400] + "…"
