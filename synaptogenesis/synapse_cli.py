"""Thin wrapper around the Synapse CLI: run builds non-interactively and parse what they print.

Synapse is the only thing that turns a codebase into an MCP server here. This
module just drives it and reads its output (the MCP client snippet, the output
file, and the endpoint table).
"""
from __future__ import annotations

import json
import os
import re
import shutil
import subprocess
import time
from dataclasses import dataclass
from pathlib import Path

ANSI = re.compile(r"\x1b\[[0-9;?]*[A-Za-z]")
ENDPOINT_ROW = re.compile(r"^[\s│|]*(GET|POST|PUT|PATCH|DELETE)\s+(/\S*)\s+([A-Za-z_][A-Za-z0-9_]*)\s*[│|]?\s*$")
WRAPPED_ROW = re.compile(r"^[\s│|]*(GET|POST|PUT|PATCH|DELETE)\s+(/\S*)\s*[│|]?\s*$")
NAME_ONLY = re.compile(r"^[\s│|]*([a-z_][a-z0-9_]*)\s*[│|]?\s*$")
OUTPUT_FILE =re.compile(r"^\s*Output\s+(\S+\.py)\s*$", re.M)


@dataclass
class SynapseRun:
    args: list[str]
    cwd: str
    returncode: int
    stdout: str
    elapsed_ms: int

    @property
    def ok(self) -> bool:
        return self.returncode == 0


def _resolve_cli() -> list[str]:
    """Run the CLI's JS entry with node directly (avoids cmd.exe mangling commas/braces on Windows)."""
    try:
        root = subprocess.run(["npm", "root", "-g"], capture_output=True, text=True, shell=os.name == "nt").stdout.strip()
        pkg = Path(root) / "@2ndbrainlabs-ai" / "synapse-cli"
        bin_field = json.loads((pkg / "package.json").read_text(encoding="utf-8"))["bin"]
        entry = bin_field if isinstance(bin_field, str) else bin_field["synapse"]
        node = shutil.which("node")
        if node and (pkg / entry).exists():
            return [node, str(pkg / entry)]
    except Exception:
        pass
    found = shutil.which("synapse")
    if not found:
        raise RuntimeError("Synapse CLI not found. Install it: npm install -g @2ndbrainlabs-ai/synapse-cli")
    return [found]


_CLI: list[str] | None = None


def run(args: list[str], cwd: str | Path, env_extra: dict[str, str] | None = None, timeout: int = 600) -> SynapseRun:
    global _CLI
    if _CLI is None:
        _CLI = _resolve_cli()
    env = {**os.environ, "SYNAPSE_TELEMETRY": os.environ.get("SYNAPSE_TELEMETRY", "0"), "NO_COLOR": "1", "FORCE_COLOR": "0"}
    if env_extra:
        env.update(env_extra)
    t0 = time.perf_counter()
    proc = subprocess.run(_CLI + args, cwd=str(cwd), env=env, capture_output=True, text=True,
                          encoding="utf-8", errors="replace", timeout=timeout)
    out = ANSI.sub("", (proc.stdout or "") + "\n" + (proc.stderr or ""))
    return SynapseRun(args=args, cwd=str(cwd), returncode=proc.returncode, stdout=out,
                      elapsed_ms=int((time.perf_counter() - t0) * 1000))


def local_env() -> dict[str, str]:
    """Env for a --local Auto build. Plain Auto calls no model, but the CLI preflights a
    provider key; if none is configured, point it at keyless Ollama so the passthrough build runs."""
    if os.environ.get("SYNAPSE_LLM_PROVIDER"):
        return {}
    if os.environ.get("ANTHROPIC_API_KEY"):
        return {}
    return {"SYNAPSE_LLM_PROVIDER": "ollama"}


def fusion_env() -> dict[str, str]:
    """Env for a --local Custom build, which needs a real model: use the first free key we have."""
    if os.environ.get("SYNAPSE_LLM_PROVIDER"):
        return {}
    for provider, key in (("groq", "GROQ_API_KEY"), ("openrouter", "OPENROUTER_API_KEY"), ("anthropic", "ANTHROPIC_API_KEY")):
        if os.environ.get(key):
            return {"SYNAPSE_LLM_PROVIDER": provider}
    return {}


def parse_mcp_snippet(stdout: str) -> dict | None:
    """Extract the {"mcpServers": {...}} JSON Synapse prints after a build; return the single server entry."""
    idx = stdout.find('"mcpServers"')
    if idx < 0:
        return None
    start = stdout.rfind("{", 0, idx)
    depth = 0
    for i in range(start, len(stdout)):
        ch = stdout[i]
        if ch == "{":
            depth += 1
        elif ch == "}":
            depth -= 1
            if depth == 0:
                try:
                    servers = json.loads(stdout[start:i + 1])["mcpServers"]
                except (json.JSONDecodeError, KeyError):
                    return None
                name, cfg = next(iter(servers.items()))
                return {"name": name, **cfg}
    return None


def parse_output_file(stdout: str) -> str | None:
    m = OUTPUT_FILE.search(stdout)
    return m.group(1) if m else None


def parse_endpoint_table(stdout: str) -> list[tuple[str, str, str]]:
    """(method, path, tool_name) rows from the endpoint table Synapse prints for non-Python repos."""
    rows = []
    lines = stdout.splitlines()
    for i, line in enumerate(lines):
        m = ENDPOINT_ROW.match(line)
        if m:
            rows.append((m.group(1), m.group(2), m.group(3)))
            continue
        # Long paths wrap: "GET /very/long/path" then the tool name alone on the next line.
        m = WRAPPED_ROW.match(line)
        if m and i + 1 < len(lines):
            nxt = NAME_ONLY.match(lines[i + 1])
            if nxt:
                rows.append((m.group(1), m.group(2), nxt.group(1)))
    return rows


def short_error(stdout: str) -> str:
    lines = [l.strip(" │╭╮╰╯─\t") for l in stdout.splitlines()]
    lines = [l for l in lines if l and ("✖" in l or "error" in l.lower() or "required" in l.lower())]
    return " | ".join(lines[:4]) or stdout.strip()[-400:]
