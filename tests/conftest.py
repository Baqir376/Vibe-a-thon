"""Shared fixtures for the Synaptogenesis test suites."""
from __future__ import annotations

import importlib.util
import shutil
import sys
import urllib.request
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))
PORTS = {"orders": 8101, "inventory": 8102, "tickets": 8103, "roster": 8104}


def load_service(name: str):
    """Import services/<name>/main.py under a unique module name (every service file is called main.py)."""
    svc_dir = ROOT / "services" / name
    if str(svc_dir) not in sys.path:
        sys.path.insert(0, str(svc_dir))  # tickets imports its sibling module `refunds`
    spec = importlib.util.spec_from_file_location(f"svc_{name}", svc_dir / "main.py")
    mod = importlib.util.module_from_spec(spec)
    sys.modules[spec.name] = mod  # pydantic resolves postponed annotations (list[OrderItem]) via sys.modules
    spec.loader.exec_module(mod)
    return mod


@pytest.fixture
def ledger(tmp_path, monkeypatch):
    """Point the refund ledger at a throwaway file for each test."""
    sys.path.insert(0, str(ROOT / "services" / "tickets"))
    import refunds
    monkeypatch.setattr(refunds, "LEDGER_FILE", tmp_path / "ledger.json")
    return refunds


@pytest.fixture
def client_for():
    """Return a TestClient for a freshly imported service (fresh in-memory data each time)."""
    def make(name: str) -> TestClient:
        return TestClient(load_service(name).app)
    return make


def services_up() -> bool:
    for port in PORTS.values():
        try:
            urllib.request.urlopen(f"http://127.0.0.1:{port}/docs", timeout=1)
        except Exception:
            return False
    return True


requires_services = pytest.mark.skipif(not services_up(), reason="legacy services not running (python scripts/run_services.py)")
requires_synapse = pytest.mark.skipif(shutil.which("synapse") is None, reason="Synapse CLI not installed")
