"""Integration: the real graft lifecycle against the running legacy services (local Synapse builds)."""
from __future__ import annotations

import asyncio
import json

import pytest

from synaptogenesis.atlas import Atlas
from synaptogenesis.config import load_policy, load_systems
from synaptogenesis.graft import GraftError, GraftManager
from tests.conftest import requires_services, requires_synapse

pytestmark = [pytest.mark.integration, requires_services, requires_synapse]


def manager(approve: bool = True) -> GraftManager:
    systems = {k: v for k, v in load_systems().items() if v.mode == "local"}
    atlas = Atlas.load_or_build(load_systems())
    async def approver(kind, detail):
        return approve
    return GraftManager(systems, atlas, load_policy(), approver)


def run(coro):
    return asyncio.run(coro)


def test_graft_call_prune_and_dormant_reactivation():
    async def go():
        gm = manager()
        try:
            r = await gm.graft("inventory", ["GET /stock/low"], "test")
            assert r["how"] == "built" and gm.live_tool_count == 1
            out, err = await gm.call("inventory__get_low_stock", {})
            assert not err and any(row["sku"] == "INS-GLAR-100" for row in json.loads(out))
            await gm.prune()
            assert gm.live_tool_count == 0 and gm.anthropic_tools() == []
            r2 = await gm.graft("inventory", ["GET /stock/low"], "again")
            assert r2["how"] == "reactivated"          # dormant connection, no new Synapse build
        finally:
            await gm.close()
    run(go())


def test_least_privilege_only_requested_tools_are_exposed():
    async def go():
        gm = manager()
        try:
            await gm.graft("tickets", ["GET /customers/{customer_id}/tickets"], "test")
            assert [t["name"] for t in gm.anthropic_tools()] == ["tickets__list_customer_tickets"]
            out, err = await gm.call("tickets__list_customer_tickets", {"customer_id": "CUS-103"})
            assert not err and "TKT-9002" in out
        finally:
            await gm.close()
    run(go())


def test_write_access_needs_a_human_and_unknown_endpoints_are_rejected():
    async def go():
        gm = manager(approve=False)
        try:
            with pytest.raises(GraftError, match="declined"):
                await gm.graft("tickets", ["POST /refunds"], "test")
            with pytest.raises(GraftError, match="no endpoint"):
                await gm.graft("tickets", ["GET /nope"], "test")
            assert gm.live_tool_count == 0
        finally:
            await gm.close()
    run(go())
