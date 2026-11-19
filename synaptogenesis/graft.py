"""Just-in-time grafting: Synapse builds an MCP server for the endpoints a task needs,
we attach it to the running agent, and prune it when the task is done.

Lifecycle of a connection (named after what synapses do):
  graft   -> Synapse builds/updates the server, we connect, and the requested tools are exposed
  prune   -> tools disappear from the agent immediately; the connection goes dormant
  regraft -> if a dormant connection already serves the endpoints, it is reactivated instantly
             (no Synapse build, no reconnect); otherwise Synapse rebuilds with the union
The agent only ever sees the tools it asked for, whatever the server underneath can do.
"""
from __future__ import annotations

import asyncio
import json
import os
import shutil
import sys
import time
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any, Awaitable, Callable

from mcp import ClientSession
from mcp.client.stdio import StdioServerParameters, stdio_client

from . import synapse_cli
from .atlas import Atlas, Capability
from .config import STATE_DIR, Policy, System
from .events import emit

GRAFT_DIR = STATE_DIR / "grafts"
HOSTED_STATE = STATE_DIR / "hosted_servers.json"
Approver = Callable[[str, dict], Awaitable[bool]]
_RUNNER: list[str] | None = None


def _compact(parts: list[str]) -> str:
    """Re-serialize JSON tool output without whitespace (FastMCP pretty-prints and splits lists
    into one content block per item). Saves tokens on free-tier model limits."""
    try:
        items = [json.loads(p) for p in parts if p.strip()]
    except ValueError:
        return "\n".join(parts)
    value = items[0] if len(items) == 1 else items
    return json.dumps(value, separators=(",", ":"), ensure_ascii=False)


def _global_runner() -> list[str] | None:
    """[node, <global synapse-mcp entry>] if the runner is installed globally (npm i -g @2ndbrainlabs-ai/synapse-mcp)."""
    global _RUNNER
    if _RUNNER is None:
        _RUNNER = []
        try:
            import subprocess
            root = subprocess.run(["npm", "root", "-g"], capture_output=True, text=True, shell=os.name == "nt").stdout.strip()
            pkg = Path(root) / "@2ndbrainlabs-ai" / "synapse-mcp"
            bin_field = json.loads((pkg / "package.json").read_text(encoding="utf-8"))["bin"]
            entry = pkg / (bin_field if isinstance(bin_field, str) else next(iter(bin_field.values())))
            node = shutil.which("node")
            if node and entry.exists():
                _RUNNER = [node, str(entry)]
        except Exception:
            pass
    return _RUNNER or None


class GraftError(Exception):
    pass


@dataclass
class Graft:
    system: str
    server_endpoints: list[str]          # what the Synapse-built server can do
    session: ClientSession
    task: asyncio.Task
    stop: asyncio.Event
    tools: dict[str, Any] = field(default_factory=dict)   # every tool the server lists
    exposed: dict[str, str] = field(default_factory=dict)  # tool name -> endpoint spec, visible to the agent
    build_ms: int = 0
    connect_ms: int = 0
    server_file: str | None = None

    @property
    def active(self) -> bool:
        return bool(self.exposed)


class GraftManager:
    def __init__(self, systems: dict[str, System], atlas: Atlas, policy: Policy, approver: Approver):
        self.systems = systems
        self.atlas = atlas
        self.policy = policy
        self.approve = approver
        self.grafts: dict[str, Graft] = {}  # active and dormant connections
        self.peak_tools = 0
        self._counter = 0
        self._locks: dict[str, asyncio.Lock] = {}
        self._approval_lock = asyncio.Lock()  # one human prompt at a time, even with parallel tool calls

    # ------------------------------------------------------------ public API

    @property
    def live_tool_count(self) -> int:
        return sum(len(g.exposed) for g in self.grafts.values())

    def active_systems(self) -> list[str]:
        return [s for s, g in self.grafts.items() if g.active]

    async def graft_many(self, requests: list[dict]) -> list[dict]:
        """Graft several systems concurrently. Each request: {system, endpoints, reason}."""
        async def one(r: dict) -> dict:
            try:
                return await self.graft(r.get("system", ""), r.get("endpoints") or [], r.get("reason", ""))
            except GraftError as e:
                return {"system": r.get("system"), "error": str(e)}
        merged: dict[str, dict] = {}  # models sometimes list one system twice; merge so it connects once
        for r in requests:
            m = merged.setdefault(r.get("system", ""), {"system": r.get("system", ""), "endpoints": [], "reason": r.get("reason", "")})
            m["endpoints"] += [e for e in (r.get("endpoints") or []) if e not in m["endpoints"]]
        return list(await asyncio.gather(*(one(r) for r in merged.values())))

    async def graft(self, system: str, endpoints: list[str], reason: str = "") -> dict:
        if system not in self.systems:
            raise GraftError(f"Unknown system '{system}'. Known: {', '.join(self.systems)}")
        if not endpoints:
            raise GraftError("No endpoints given. Pass exact 'METHOD /path' strings from find_capability.")
        caps: list[Capability] = []
        for spec in endpoints:
            cap = self.atlas.by_spec(system, spec)
            if not cap:
                raise GraftError(f"{system} has no endpoint '{spec}'. Use find_capability to get exact endpoints.")
            if self.policy.denied(system, cap.method, cap.path):
                emit("graft.denied", system=system, endpoint=cap.spec, reason="policy")
                raise GraftError(f"Policy forbids grafting {system}:{cap.spec}. A human must do this.")
            caps.append(cap)

        lock = self._locks.setdefault(system, asyncio.Lock())
        async with lock:
            g = self.grafts.get(system)
            exposed_specs = set(g.exposed.values()) if g else set()
            want_specs = exposed_specs | {c.spec for c in caps}
            new_caps = [c for c in caps if c.spec not in exposed_specs]
            if not new_caps:
                return self._describe(g, "already_live")

            new_writes = [c.spec for c in new_caps if self.policy.needs_approval(c.method)]
            if new_writes:
                async with self._approval_lock:
                    approved = await self.approve("graft", {"system": system, "endpoints": new_writes, "reason": reason})
            if new_writes and not approved:
                emit("graft.declined", system=system, endpoints=new_writes)
                raise GraftError(f"Human declined granting write access to {system}: {new_writes}")
            if self.live_tool_count - len(exposed_specs) + len(want_specs) > self.policy.max_live_tools:
                raise GraftError(f"Would exceed max_live_tools={self.policy.max_live_tools}. Prune something first.")

            emit("graft.start", system=system, endpoints=sorted(want_specs), reason=reason)
            how = "reactivated"
            if not g or not want_specs <= set(g.server_endpoints):
                # The server underneath can't serve this yet: Synapse (re)builds it.
                server_specs = sorted(want_specs | (set(g.server_endpoints) if g else set()))
                cfg, build_ms, server_file = await asyncio.to_thread(self._build, self.systems[system], server_specs)
                server_specs = cfg.pop("_server_endpoints", server_specs)
                if g:
                    await self._close(g)
                g = await self._connect(system, server_specs, cfg)
                g.build_ms, g.server_file = build_ms, server_file
                self.grafts[system] = g
                how = "built" if build_ms else "connected_cached_server"
            self._expose(g, want_specs)
            self.peak_tools = max(self.peak_tools, self.live_tool_count)
            emit("graft.done", system=system, endpoints=sorted(want_specs), tools=list(g.exposed), how=how,
                 build_ms=g.build_ms if how == "built" else 0, connect_ms=g.connect_ms if how != "reactivated" else 0,
                 live_tools=self.live_tool_count)
            return self._describe(g, how)

    async def prune(self, system: str | None = None) -> list[str]:
        """Remove tools from the agent. The connection stays dormant for instant reuse."""
        pruned = []
        for name in ([system] if system else list(self.grafts)):
            g = self.grafts.get(name)
            if g and g.active:
                tools = list(g.exposed)
                g.exposed = {}
                pruned.append(name)
                emit("prune", system=name, tools=tools, live_tools=self.live_tool_count)
        return pruned

    def anthropic_tools(self) -> list[dict]:
        tools = []
        for g in self.grafts.values():
            for name in g.exposed:
                t = g.tools[name]
                cap = self.atlas.lookup(g.system, name)
                tag = " [CHANGES DATA - requires human approval]" if self.policy.needs_approval(cap.method if cap else None) else ""
                tools.append({"name": f"{g.system}__{name}"[:64],
                              "description": f"[{g.system}] {t.description or name}{tag}",
                              "input_schema": t.inputSchema or {"type": "object", "properties": {}}})
        return tools

    def owns(self, qualified: str) -> bool:
        system, _, name = qualified.partition("__")
        return system in self.grafts and name in self.grafts[system].exposed

    async def call(self, qualified: str, args: dict) -> tuple[str, bool]:
        system, _, name = qualified.partition("__")
        g = self.grafts[system]
        cap = self.atlas.lookup(system, name)
        method = cap.method if cap else None
        if self.policy.needs_approval(method):
            async with self._approval_lock:
                ok = await self.approve("call", {"system": system, "tool": name, "endpoint": cap.spec if cap else "?", "args": args})
            emit("approval", system=system, tool=name, approved=ok)
            if not ok:
                return "The human reviewer declined this action. Do not retry it; tell the user what you would have done.", True
        t0 = time.perf_counter()
        emit("tool.call", system=system, tool=name, args=args)
        try:
            res = await g.session.call_tool(name, args)
        except Exception as e:  # transport failure
            emit("tool.result", system=system, tool=name, ok=False, ms=int((time.perf_counter() - t0) * 1000))
            return f"Tool transport error: {e}", True
        text = _compact([getattr(c, "text", "") or "" for c in res.content])
        if res.structuredContent and not text.strip():
            text = json.dumps(res.structuredContent)
        emit("tool.result", system=system, tool=name, ok=not res.isError, ms=int((time.perf_counter() - t0) * 1000),
             chars=len(text))
        return text[:20000], bool(res.isError)

    async def warm(self, read_only: bool = True, reset: bool = False) -> list[dict]:
        """Pre-build hosted servers so the first graft in a demo doesn't wait on a cloud build.
        Only builds the server; nothing is exposed to any agent. reset=True forgets endpoints
        added by earlier grafts (e.g. a demo endpoint), so the server is exactly the read-only surface."""
        out = []
        state = self._hosted_state()
        if reset:
            for s in self.systems.values():
                state.pop(s.name, None)
            HOSTED_STATE.write_text(json.dumps(state, indent=1), encoding="utf-8")
        for s in self.systems.values():
            if s.mode != "hosted":
                continue
            specs = sorted({c.spec for c in self.atlas.caps if c.system == s.name and (not read_only or not c.mutating)
                            and not self.policy.denied(s.name, c.method, c.path)}
                           | set((state.get(s.name) or {}).get("endpoints", [])))
            _, build_ms, _ = await asyncio.to_thread(self._build, s, specs)
            out.append({"system": s.name, "endpoints": len(specs), "build_ms": build_ms})
        return out

    async def prewarm(self) -> list[dict]:
        """Have Synapse build + connect every system's read-only surface up front, exposing NOTHING.
        Grafts then reactivate these dormant connections instantly. Write endpoints still need a live
        build and human approval. Optional: for live demos and latency-sensitive use."""
        async def one(s: System) -> dict:
            specs = sorted(c.spec for c in self.atlas.caps if c.system == s.name and not c.mutating
                           and not self.policy.denied(s.name, c.method, c.path))
            t0 = time.perf_counter()
            try:
                cfg, build_ms, server_file = await asyncio.to_thread(self._build, s, specs)
                specs = cfg.pop("_server_endpoints", specs)
                g = await self._connect(s.name, specs, cfg)
            except GraftError as e:
                return {"system": s.name, "error": str(e)}
            g.build_ms, g.server_file = build_ms, server_file
            self.grafts[s.name] = g
            emit("prewarm", system=s.name, endpoints=len(specs), ms=int((time.perf_counter() - t0) * 1000))
            return {"system": s.name, "endpoints": len(specs), "ms": int((time.perf_counter() - t0) * 1000)}
        return list(await asyncio.gather(*(one(s) for s in self.systems.values())))

    async def close(self) -> None:
        for g in list(self.grafts.values()):
            await self._close(g)
        self.grafts.clear()

    # ------------------------------------------------------------ internals

    def _expose(self, g: Graft, specs: set[str]) -> None:
        exposed = {}
        for spec in specs:
            cap = self.atlas.by_spec(g.system, spec)
            if cap and cap.tool in g.tools:
                exposed[cap.tool] = spec
            elif len(specs) == 1 and len(g.tools) == 1:  # name mismatch on a single-tool server
                exposed[next(iter(g.tools))] = spec
        if not exposed:
            raise GraftError(f"Synapse built {g.system} but none of its tools matched {sorted(specs)}")
        g.exposed = exposed

    def _describe(self, g: Graft, how: str) -> dict:
        return {"system": g.system, "live_tools_for_system": [f"{g.system}__{n}" for n in g.exposed],
                "how": how, "synapse_build_ms": g.build_ms if how == "built" else 0,
                "live_tools_total": self.live_tool_count}

    def _hosted_state(self) -> dict:
        try:
            return json.loads(HOSTED_STATE.read_text(encoding="utf-8"))
        except (OSError, ValueError):
            return {}

    def _build(self, system: System, endpoints: list[str]) -> tuple[dict, int, str | None]:
        if system.mode == "hosted":
            # Synapse keeps the hosted server config in the cloud. If it already serves these
            # endpoints, connect to it as is (a rebuild is free but takes ~6-10 s).
            state = self._hosted_state()
            cached = state.get(system.name)
            if cached and cached.get("cfg") and set(endpoints) <= set(cached.get("endpoints", [])):
                emit("graft.reused_hosted", system=system.name, endpoints=endpoints)
                cfg = self._finalize_cfg(system, dict(cached["cfg"]))
                cfg["_server_endpoints"] = sorted(cached["endpoints"])
                return cfg, 0, None
            if cached:
                endpoints = sorted(set(endpoints) | set(cached.get("endpoints", [])))
            args = ["build", "--auto", "--endpoints", ",".join(endpoints), "--yes",
                    "--base-url", system.base_url, "--server-name", f"synapto-{system.name}"]
            run = synapse_cli.run(args, cwd=system.path)
        else:
            args = ["build", "--local", "--auto", "--endpoints", ",".join(endpoints), "--yes"]
            run = synapse_cli.run(args, cwd=system.path, env_extra=synapse_cli.local_env())
        cfg = synapse_cli.parse_mcp_snippet(run.stdout)
        if not run.ok or not cfg:
            emit("graft.failed", system=system.name, endpoints=endpoints, error=synapse_cli.short_error(run.stdout))
            raise GraftError(f"Synapse build failed for {system.name}: {synapse_cli.short_error(run.stdout)}")

        server_file = None
        if system.mode != "hosted":
            src = synapse_cli.parse_output_file(run.stdout)
            src_path = Path(src) if src and Path(src).is_absolute() else system.path / (src or "synapse_auto_server.py")
            GRAFT_DIR.mkdir(parents=True, exist_ok=True)
            self._counter += 1
            dest = GRAFT_DIR / f"{system.name}_{int(time.time())}_{self._counter}.py"
            shutil.move(str(src_path), dest)  # keep the legacy repo untouched
            (system.path / ".env.example").unlink(missing_ok=True)
            server_file = str(dest)
            cfg["command"] = sys.executable if cfg.get("command", "python").startswith("python") else cfg["command"]
            cfg["args"] = [server_file]
        else:
            state = self._hosted_state()
            state[system.name] = {"endpoints": endpoints, "cfg": cfg}
            STATE_DIR.mkdir(exist_ok=True)
            HOSTED_STATE.write_text(json.dumps(state, indent=1), encoding="utf-8")
        return self._finalize_cfg(system, cfg), run.elapsed_ms, server_file

    def _finalize_cfg(self, system: System, cfg: dict) -> dict:
        # Prefer a globally installed runner over `npx -y` (saves seconds per graft).
        if cfg.get("command") == "npx" and any("synapse-mcp" in a for a in cfg.get("args", [])):
            runner = _global_runner()
            if runner:
                cfg["command"], cfg["args"] = runner[0], runner[1:]
        # Synapse prints placeholders like "<your key>"; treat them as unset and fill from our env.
        env = {k: ("" if not v or (v.startswith("<") and v.endswith(">")) else v)
               for k, v in (cfg.get("env") or {}).items()}
        for k, v in list(env.items()):
            if not v and k in ("ENDPOINT_BASE_URL", "BASE_URL", "API_BASE_URL"):
                env[k] = system.base_url
            elif not v and os.environ.get(k):
                env[k] = os.environ[k]
            elif not v:
                raise GraftError(f"Synapse's MCP config for {system.name} needs {k}. Set it in .env or the environment.")
        cfg["env"] = env
        return cfg

    async def _connect(self, system: str, endpoints: list[str], cfg: dict) -> Graft:
        """Each connection lives in its own task that owns the stdio/session contexts, so
        connections can be opened and closed in any order (anyio requires the same task)."""
        t0 = time.perf_counter()
        command = cfg["command"]
        if os.name == "nt" and command in ("npx", "npm"):
            command = shutil.which(command) or command
        params = StdioServerParameters(command=command, args=cfg.get("args", []), env={**os.environ, **cfg["env"]})
        GRAFT_DIR.mkdir(parents=True, exist_ok=True)
        errlog = open(GRAFT_DIR / f"{system}.log", "a", encoding="utf-8")
        ready: asyncio.Future = asyncio.get_running_loop().create_future()
        stop = asyncio.Event()

        async def holder() -> None:
            try:
                async with stdio_client(params, errlog=errlog) as (read, write):
                    async with ClientSession(read, write) as session:
                        await session.initialize()
                        listed = await session.list_tools()
                        ready.set_result((session, listed))
                        await stop.wait()
            except BaseException as e:  # noqa: BLE001 - surface startup failures to the caller
                if not ready.done():
                    ready.set_exception(e)
            finally:
                errlog.close()

        task = asyncio.create_task(holder(), name=f"graft-{system}")
        try:
            session, listed = await asyncio.wait_for(ready, timeout=60)
        except BaseException as e:
            stop.set()
            task.cancel()
            raise GraftError(f"Could not start the Synapse MCP server for {system}: {e!r}. "
                             f"See {GRAFT_DIR / (system + '.log')}") from None
        g = Graft(system=system, server_endpoints=endpoints, session=session, task=task, stop=stop,
                  tools={t.name: t for t in listed.tools})
        g.connect_ms = int((time.perf_counter() - t0) * 1000)
        return g

    async def _close(self, g: Graft) -> None:
        g.stop.set()
        try:
            await asyncio.wait_for(g.task, timeout=5)
        except BaseException:  # noqa: BLE001 - shutdown is best effort
            g.task.cancel()
        if g.server_file:
            Path(g.server_file).unlink(missing_ok=True)
