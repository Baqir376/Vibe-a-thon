from __future__ import annotations

import fnmatch
import os
from dataclasses import dataclass, field
from pathlib import Path

import yaml

ROOT = Path(__file__).resolve().parent.parent
STATE_DIR = ROOT / ".synapto"
MUTATING = {"POST", "PUT", "PATCH", "DELETE"}


def _load_dotenv(path: Path = ROOT / ".env") -> None:
    """Minimal KEY=VALUE loader (git-ignored file). Real environment variables win."""
    if not path.exists():
        return
    for line in path.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if line and not line.startswith("#") and "=" in line:
            k, v = line.split("=", 1)
            os.environ.setdefault(k.strip(), v.strip().strip('"').strip("'"))


_load_dotenv()


@dataclass
class System:
    name: str
    path: Path
    base_url: str
    mode: str  # "local" (python, --local file) or "hosted" (Synapse runner via npx)
    description: str


@dataclass
class Policy:
    deny: list[str] = field(default_factory=list)
    approval_methods: set[str] = field(default_factory=lambda: set(MUTATING))
    max_live_tools: int = 12

    def denied(self, system: str, method: str, path: str) -> bool:
        key = f"{system}:{method} {path}"
        return any(fnmatch.fnmatch(key, pat) for pat in self.deny)

    def needs_approval(self, method: str | None) -> bool:
        # Unknown method => treat as mutating (fail safe).
        return method is None or method.upper() in self.approval_methods


def load_systems(path: Path = ROOT / "systems.yaml") -> dict[str, System]:
    raw = yaml.safe_load(path.read_text(encoding="utf-8"))["systems"]
    out = {}
    for name, cfg in raw.items():
        mode = os.environ.get(f"SYNAPTO_MODE_{name.upper()}", cfg.get("mode", "local"))
        out[name] = System(name=name, path=(ROOT / cfg["path"]).resolve(), base_url=cfg["base_url"],
                           mode=mode, description=cfg.get("description", ""))
    return out


def load_policy(path: Path = ROOT / "policy.yaml") -> Policy:
    if not path.exists():
        return Policy()
    raw = yaml.safe_load(path.read_text(encoding="utf-8")) or {}
    return Policy(deny=raw.get("deny", []),
                  approval_methods={m.upper() for m in raw.get("require_approval_methods", MUTATING)},
                  max_live_tools=int(raw.get("max_live_tools", 12)))
