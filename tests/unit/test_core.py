"""Unit tests: parsers of Synapse output, the atlas, policy, fusion learning and agent helpers."""
from __future__ import annotations

import json

import pytest

from synaptogenesis import synapse_cli
from synaptogenesis.atlas import Atlas, Capability, capabilities_from_server_file
from synaptogenesis.config import Policy, System
from synaptogenesis.graft import _compact

# ---------------------------------------------------------------- Synapse CLI output parsing

SNIPPET = '''
  Add to your MCP client:
    {
      "mcpServers": {
        "orders": {
          "command": "npx",
          "args": ["-y", "@2ndbrainlabs-ai/synapse-mcp"],
          "env": {"SYNAPSE_SERVER_ID": "abc", "SYNAPSE_API_KEY": "<your key>", "ENDPOINT_BASE_URL": ""}
        }
      }
    }
  ✦  Ready.
'''


def test_parse_mcp_snippet_returns_single_server():
    cfg = synapse_cli.parse_mcp_snippet(SNIPPET)
    assert cfg["name"] == "orders"
    assert cfg["command"] == "npx"
    assert cfg["env"]["SYNAPSE_SERVER_ID"] == "abc"


def test_parse_mcp_snippet_handles_missing_and_broken_json():
    assert synapse_cli.parse_mcp_snippet("no config here") is None
    assert synapse_cli.parse_mcp_snippet('{"mcpServers": {broken') is None


def test_parse_output_file():
    assert synapse_cli.parse_output_file("  Output      synapse_auto_server_3.py\n") == "synapse_auto_server_3.py"
    assert synapse_cli.parse_output_file("nothing") is None


def test_parse_endpoint_table_including_wrapped_rows():
    table = """
  │    GET    /staff                         get_staff                           │
  │    GET    /customers/:customerId/account-manager                             │
  │  get_customers_by_param_account_manager                                      │
  │    POST   /pages                         create_pages                        │
"""
    rows = synapse_cli.parse_endpoint_table(table)
    assert ("GET", "/staff", "get_staff") in rows
    assert ("GET", "/customers/:customerId/account-manager", "get_customers_by_param_account_manager") in rows
    assert ("POST", "/pages", "create_pages") in rows
    assert len(rows) == 3


# ---------------------------------------------------------------- atlas

GENERATED = '''
from mcp.server.fastmcp import FastMCP
import os, requests
mcp = FastMCP("tickets")

@mcp.tool(name="get_ticket", description="Get one ticket.")
def get_ticket(ticket_id: Any = None) -> dict:
    url = f"{os.environ["ENDPOINT_BASE_URL"]}/tickets/{ticket_id}"
    resp = requests.get(url, headers={})
    return resp.json()

@mcp.tool(name="create_refund", description="Issue a refund.")
def create_refund(ticket_id: Any = None, reason: Any = None) -> dict:
    url = f"{os.environ["ENDPOINT_BASE_URL"]}/refunds"
    payload = {"ticket_id": ticket_id, "reason": reason}
    resp = requests.post(url, json=payload)
    return resp.json()
'''


def test_capabilities_from_generated_server_file():
    caps = {c.tool: c for c in capabilities_from_server_file("tickets", GENERATED)}
    assert caps["get_ticket"].method == "GET" and caps["get_ticket"].path == "/tickets/{ticket_id}"
    assert caps["create_refund"].method == "POST" and caps["create_refund"].mutating
    assert caps["create_refund"].params == ["ticket_id", "reason"]


def _atlas():
    systems = {n: System(n, None, "http://x", "local", d) for n, d in
               [("orders", "orders and shipments"), ("tickets", "support tickets and refunds")]}
    caps = [Capability("orders", "list_delayed_shipments", "GET", "/shipments/delayed", "Shipments that are delayed"),
            Capability("orders", "get_order", "GET", "/orders/{order_id}", "Get one order"),
            Capability("tickets", "list_customer_tickets", "GET", "/customers/{customer_id}/tickets", "Tickets of a customer"),
            Capability("tickets", "create_refund", "POST", "/refunds", "Issue a refund")]
    a = Atlas(caps, systems)
    a.save = lambda: None  # never write to disk in tests
    return a


def test_search_ranks_the_right_endpoint_first():
    a = _atlas()
    assert a.search("which shipments are delayed")[0]["tool"] == "list_delayed_shipments"
    assert a.search("tickets for a customer")[0]["tool"] == "list_customer_tickets"
    assert a.search("zzz nothing matches") == []


def test_search_hides_superseded_write_steps():
    a = _atlas()
    assert any(h["tool"] == "create_refund" for h in a.search("refund"))
    a.superseded.add(("tickets", "create_refund"))
    assert not any(h["tool"] == "create_refund" for h in a.search("refund"))


def test_replace_system_reports_added_and_removed():
    a = _atlas()
    new = [Capability("orders", "list_delayed_shipments", "GET", "/shipments/delayed"),
           Capability("orders", "get_shipment_eta", "GET", "/shipments/{shipment_id}/eta")]
    added, removed = a.replace_system("orders", new)
    assert [c.spec for c in added] == ["GET /shipments/{shipment_id}/eta"]
    assert [c.spec for c in removed] == ["GET /orders/{order_id}"]


def test_by_spec_accepts_spec_or_tool_name():
    a = _atlas()
    assert a.by_spec("orders", "GET  /orders/{order_id}").tool == "get_order"
    assert a.by_spec("orders", "get_order").spec == "GET /orders/{order_id}"
    assert a.by_spec("orders", "GET /nope") is None


# ---------------------------------------------------------------- policy

def test_policy_denies_by_pattern_and_requires_approval_for_writes():
    p = Policy(deny=["*:DELETE *", "orders:POST /shipments/*/reroute"])
    assert p.denied("tickets", "DELETE", "/tickets/1")
    assert p.denied("orders", "POST", "/shipments/{shipment_id}/reroute")
    assert not p.denied("orders", "GET", "/shipments/delayed")
    assert p.needs_approval("POST") and p.needs_approval("patch")
    assert not p.needs_approval("GET")
    assert p.needs_approval(None)  # unknown method => fail safe


# ---------------------------------------------------------------- helpers

def test_compact_merges_split_json_and_keeps_text():
    assert json.loads(_compact(['{"a": 1}', '{"b": 2}'])) == [{"a": 1}, {"b": 2}]
    assert _compact(['{\n  "a": 1\n}']) == '{"a":1}'
    assert _compact(["plain text"]) == "plain text"


def test_clean_schema_types_untyped_params_and_drops_noise():
    from synaptogenesis.agent import _clean_schema
    s = _clean_schema({"$schema": "x", "title": "T", "properties": {"sku": {"title": "Sku", "default": None}}})
    assert s == {"type": "object", "properties": {"sku": {"type": "string"}}}


def test_routes_prefer_free_providers(monkeypatch):
    from synaptogenesis import agent
    for k in ("GEMINI_API_KEY", "GROQ_API_KEY", "OPENROUTER_API_KEY", "SYNAPTO_PROVIDER", "SYNAPTO_MODEL"):
        monkeypatch.delenv(k, raising=False)
    monkeypatch.setenv("GROQ_API_KEY", "x")
    monkeypatch.setenv("OPENROUTER_API_KEY", "y")
    routes = agent.build_routes()
    assert routes[0][0] == "groq" and ("openrouter", agent.FREE_MODELS["openrouter"][0]) in routes
    monkeypatch.setenv("SYNAPTO_PROVIDER", "openrouter")
    assert {p for p, _ in agent.build_routes()} == {"openrouter"}


# ---------------------------------------------------------------- fusion learning

@pytest.fixture
def fusion(tmp_path, monkeypatch):
    from synaptogenesis import fusion as f
    monkeypatch.setattr(f, "HEBBIAN", tmp_path / "hebbian.json")
    monkeypatch.setattr(f, "REGISTRY", tmp_path / "fused.json")
    monkeypatch.setattr(f, "STATE_DIR", tmp_path)
    a = _atlas()
    a.caps.append(Capability("tickets", "get_ticket", "GET", "/tickets/{ticket_id}"))
    systems = {**a.systems}
    for s in systems.values():
        s.path = tmp_path  # has no main.py → fusion of read-only chains is never proposed anyway
    (tmp_path / "main.py").write_text("")
    return f.Fusion(systems, a)


def _trace(t):
    return [{"tool": "tickets__get_ticket", "input": {"ticket_id": t}, "is_error": False},
            {"tool": "orders__get_order", "input": {"order_id": "O"}, "is_error": False},
            {"tool": "tickets__create_refund", "input": {"ticket_id": t, "reason": "damaged"}, "is_error": False}]


def test_fusion_needs_a_repeated_chain_with_a_write(fusion):
    assert fusion.observe(_trace("T1")) == []
    ready = fusion.observe(_trace("T2"))
    assert [(r["system"], [c["tool"] for c in r["chain"]]) for r in ready] == [("tickets", ["get_ticket", "create_refund"])]


def test_fusion_ignores_read_only_and_failed_chains(fusion):
    reads = [{"tool": "tickets__get_ticket", "input": {}, "is_error": False},
             {"tool": "tickets__list_customer_tickets", "input": {}, "is_error": False}]
    assert fusion.observe(reads) == [] and fusion.observe(reads) == []
    failed = [dict(s, is_error=True) for s in _trace("T")]
    assert fusion.observe(failed) == [] and fusion.observe(failed) == []
