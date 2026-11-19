"""Contract tests: what Synapse generates must match what the APIs actually accept.

Runs the real Synapse CLI (local Auto, no model, no quota) on a throwaway copy of each Python
service and compares the generated MCP tools with FastAPI's own OpenAPI document.
Guards against Synapse 0.1.9 dropping body fields (Literal types / trailing comments, issue #1 in
docs/synapse-issues.md): if someone reintroduces that pattern, this test fails.
"""
from __future__ import annotations

import shutil
from pathlib import Path

import pytest

from synaptogenesis import synapse_cli
from synaptogenesis.atlas import capabilities_from_server_file
from tests.conftest import ROOT, load_service, requires_synapse

PY_SERVICES = ["orders", "inventory", "tickets", "roster"]


def openapi_surface(name: str) -> dict[str, set[str]]:
    """{'METHOD /path': {param names}} from FastAPI's OpenAPI (path params + JSON body fields)."""
    spec = load_service(name).app.openapi()
    schemas = spec.get("components", {}).get("schemas", {})
    out = {}
    for path, ops in spec["paths"].items():
        for method, op in ops.items():
            params = {p["name"] for p in op.get("parameters", []) if p["in"] == "path"}
            body = op.get("requestBody", {}).get("content", {}).get("application/json", {}).get("schema", {})
            ref = body.get("$ref", "").split("/")[-1]
            if ref:
                params |= set(schemas[ref].get("properties", {}))
            out[f"{method.upper()} {path}"] = params
    return out


@requires_synapse
@pytest.mark.contract
@pytest.mark.parametrize("name", PY_SERVICES)
def test_synapse_tools_cover_every_endpoint_and_field(name, tmp_path):
    work = tmp_path / name
    work.mkdir()
    for f in (ROOT / "services" / name).glob("*.py"):
        if not f.name.endswith("_server.py"):
            shutil.copy2(f, work / f.name)
    shutil.copy2(ROOT / "services" / name / "requirements.txt", work / "requirements.txt")

    run = synapse_cli.run(["build", "--local", "--auto", "--all-endpoints", "--yes"], work, synapse_cli.local_env())
    assert run.ok, synapse_cli.short_error(run.stdout)
    out = Path(synapse_cli.parse_output_file(run.stdout))
    out = out if out.is_absolute() else work / out
    tools = {c.spec: set(c.params) for c in capabilities_from_server_file(name, out.read_text(encoding="utf-8"))}

    expected = openapi_surface(name)
    assert set(tools) == set(expected), f"endpoints differ: {set(tools) ^ set(expected)}"
    missing = {spec: sorted(expected[spec] - tools[spec]) for spec in expected if expected[spec] - tools[spec]}
    # Query parameters are a known Synapse local-Auto gap (issue #3); every PATH and BODY field must be present.
    assert not missing, f"Synapse dropped request fields: {missing}"
