"""Capability Atlas: a searchable index of every endpoint in every system.

The surface comes from Synapse's own scan (tree-sitter, client side):
- Python repos: an --all-endpoints --local build; we read the generated tool
  definitions (name, description, HTTP method, path, params) from the file's AST.
- Other repos: Synapse prints the detected endpoint table (method, path, tool name).
Nothing here is exposed to the agent as a tool yet - the Atlas only answers
"which system can do X?". Grafting is what makes a capability callable.
"""
from __future__ import annotations

import ast
import json
import re
from dataclasses import asdict, dataclass, field
from pathlib import Path

from . import synapse_cli
from .config import MUTATING, STATE_DIR, System
from .events import emit

ATLAS_FILE = STATE_DIR / "atlas.json"
HTTP_METHODS = {"get", "post", "put", "patch", "delete"}
JSDOC_ROUTE = re.compile(r"/\*\*(.*?)\*/\s*app\.(get|post|put|patch|delete)\(\s*[\"'`]([^\"'`]+)", re.S)


@dataclass
class Capability:
    system: str
    tool: str
    method: str
    path: str
    description: str = ""
    params: list[str] = field(default_factory=list)

    @property
    def spec(self) -> str:
        return f"{self.method} {self.path}"

    @property
    def mutating(self) -> bool:
        return self.method in MUTATING


# ---------------------------------------------------------------- scanning

def _route_from_fstring(node: ast.JoinedStr) -> str:
    parts = []
    for i, v in enumerate(node.values):
        if isinstance(v, ast.Constant):
            parts.append(str(v.value))
        elif isinstance(v, ast.FormattedValue):
            if i == 0:  # the os.environ[...] base URL
                continue
            parts.append("{" + (v.value.id if isinstance(v.value, ast.Name) else "param") + "}")
    return "".join(parts)


def capabilities_from_server_file(system: str, source: str) -> list[Capability]:
    """Read tool definitions out of a Synapse-generated passthrough server."""
    caps = []
    for fn in ast.parse(source).body:
        if not isinstance(fn, ast.FunctionDef):
            continue
        name, desc = fn.name, ""
        for dec in fn.decorator_list:
            if isinstance(dec, ast.Call) and getattr(dec.func, "attr", "") == "tool":
                for kw in dec.keywords:
                    if kw.arg == "name" and isinstance(kw.value, ast.Constant):
                        name = kw.value.value
                    if kw.arg == "description" and isinstance(kw.value, ast.Constant):
                        desc = kw.value.value
        method, path = None, None
        for node in ast.walk(fn):
            if isinstance(node, ast.Assign) and isinstance(node.value, ast.JoinedStr) and any(
                    isinstance(t, ast.Name) and t.id == "url" for t in node.targets):
                path = _route_from_fstring(node.value)
            if isinstance(node, ast.Call) and isinstance(node.func, ast.Attribute) and node.func.attr in HTTP_METHODS \
                    and isinstance(node.func.value, ast.Name) and node.func.value.id == "requests":
                method = node.func.attr.upper()
        if method and path:
            caps.append(Capability(system, name, method, path, desc, [a.arg for a in fn.args.args]))
    return caps


def _jsdoc_descriptions(repo: Path) -> dict[tuple[str, str], str]:
    out = {}
    for f in list(repo.glob("src/**/*.ts")) + list(repo.glob("*.ts")):
        for m in JSDOC_ROUTE.finditer(f.read_text(encoding="utf-8", errors="ignore")):
            text = " ".join(l.strip(" *") for l in m.group(1).splitlines()).strip()
            out[(m.group(2).upper(), m.group(3))] = text
    return out


def scan_system(system: System) -> list[Capability]:
    run = synapse_cli.run(["build", "--local", "--auto", "--all-endpoints", "--discover", "--yes"], cwd=system.path,
                          env_extra=synapse_cli.local_env())
    out_file = synapse_cli.parse_output_file(run.stdout)
    if out_file:
        p = Path(out_file)
        p = p if p.is_absolute() else system.path / p
        caps = capabilities_from_server_file(system.name, p.read_text(encoding="utf-8"))
        p.unlink(missing_ok=True)  # the Atlas only needs the surface, not a running server
    else:
        docs = _jsdoc_descriptions(system.path)
        caps = [Capability(system.name, tool, method, path, docs.get((method, path), ""),
                           re.findall(r":(\w+)", path))
                for method, path, tool in synapse_cli.parse_endpoint_table(run.stdout)]
    if not caps:
        raise RuntimeError(f"Synapse found no endpoints in {system.name}: {synapse_cli.short_error(run.stdout)}")
    emit("atlas.scanned", system=system.name, endpoints=len(caps), ms=run.elapsed_ms)
    return caps


# ---------------------------------------------------------------- index + search

class Atlas:
    def __init__(self, caps: list[Capability], systems: dict[str, System]):
        self.caps = caps
        self.systems = systems

    @classmethod
    def build(cls, systems: dict[str, System]) -> "Atlas":
        caps = []
        for s in systems.values():
            caps.extend(scan_system(s))
        atlas = cls(caps, systems)
        atlas.save()
        return atlas

    @classmethod
    def load_or_build(cls, systems: dict[str, System]) -> "Atlas":
        if ATLAS_FILE.exists():
            data = json.loads(ATLAS_FILE.read_text(encoding="utf-8"))
            if set(data.get("systems", [])) == set(systems):
                return cls([Capability(**c) for c in data["capabilities"]], systems)
        return cls.build(systems)

    def save(self) -> None:
        STATE_DIR.mkdir(exist_ok=True)
        ATLAS_FILE.write_text(json.dumps({"systems": list(self.systems),
                                          "capabilities": [asdict(c) for c in self.caps]}, indent=1), encoding="utf-8")

    def replace_system(self, system: str, caps: list[Capability]) -> tuple[list[Capability], list[Capability]]:
        """Swap in a rescanned surface; return (added, removed)."""
        old = {c.spec: c for c in self.caps if c.system == system}
        new = {c.spec: c for c in caps}
        self.caps = [c for c in self.caps if c.system != system] + caps
        self.save()
        return [new[k] for k in new.keys() - old.keys()], [old[k] for k in old.keys() - new.keys()]

    def lookup(self, system: str, tool: str) -> Capability | None:
        return next((c for c in self.caps if c.system == system and c.tool == tool), None)

    def by_spec(self, system: str, spec: str) -> Capability | None:
        spec = " ".join(spec.split())
        return next((c for c in self.caps if c.system == system and (c.spec == spec or c.tool == spec)), None)

    @staticmethod
    def _tokens(text: str) -> list[str]:
        words = re.findall(r"[a-z0-9]+", re.sub(r"([a-z])([A-Z])", r"\1 \2", text).lower())
        return [w[:-1] if len(w) > 3 and w.endswith("s") else w for w in words]

    def search(self, query: str, k: int = 8) -> list[dict]:
        q = set(self._tokens(query))
        scored = []
        for c in self.caps:
            sys_desc = self.systems[c.system].description if c.system in self.systems else ""
            strong = set(self._tokens(f"{c.tool} {c.path}"))
            weak = set(self._tokens(c.description))
            ctx = set(self._tokens(f"{c.system} {sys_desc}"))
            score = 3 * len(q & strong) + 2 * len(q & weak) + 0.5 * len(q & ctx)
            if score:
                scored.append((score, c))
        scored.sort(key=lambda x: (-x[0], x[1].mutating))
        return [{"system": c.system, "endpoint": c.spec, "tool": c.tool, "description": c.description,
                 "params": c.params, "changes_data": c.mutating} for _, c in scored[:k]]

    def summary(self) -> list[dict]:
        out = []
        for name, s in self.systems.items():
            caps = [c for c in self.caps if c.system == name]
            out.append({"system": name, "description": s.description, "endpoints": len(caps),
                        "read_only": sum(not c.mutating for c in caps)})
        return out
