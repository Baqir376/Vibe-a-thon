"""The agent server's HTTP API (FastAPI TestClient; no model calls, atlas faked)."""
from __future__ import annotations

import os

import pytest
from fastapi.testclient import TestClient

os.environ.setdefault("GROQ_API_KEY", "test-key-not-used")  # the agent client is built at startup


@pytest.fixture
def client(monkeypatch):
    from synaptogenesis import web
    from synaptogenesis.atlas import Atlas, Capability

    def fake_atlas(systems):
        a = Atlas([Capability("orders", "list_delayed_shipments", "GET", "/shipments/delayed", "Delayed shipments")], systems)
        a.save = lambda: None
        return a
    monkeypatch.setattr(web.Atlas, "load_or_build", staticmethod(fake_atlas))
    with TestClient(web.build_app()) as c:
        yield c


def test_state_lists_systems_and_capabilities(client):
    st = client.get("/api/state").json()
    assert {s["name"] for s in st["systems"]} >= {"orders", "inventory", "tickets", "roster"}
    assert st["capabilities"][0]["spec"] == "GET /shipments/delayed"
    assert st["busy"] is False and st["grafts"] == []


def test_ask_validates_input(client):
    assert client.post("/api/ask", json={"question": "   "}).status_code == 400
    assert client.post("/api/ask", json={}).status_code == 422


def test_unknown_approval_is_404(client):
    assert client.post("/api/approve", json={"id": 99999, "approved": True}).status_code == 404


def test_cors_allows_the_frontend(client):
    r = client.options("/api/state", headers={"Origin": "http://localhost:3000", "Access-Control-Request-Method": "GET"})
    assert r.headers.get("access-control-allow-origin") == "http://localhost:3000"
