"""Component tests for the four legacy services (FastAPI TestClient, in-memory data)."""
from __future__ import annotations

import pytest


# ---------------------------------------------------------------- orders

def test_orders_delayed_shipment_and_its_customers(client_for):
    c = client_for("orders")
    delayed = c.get("/shipments/delayed").json()
    assert [s["id"] for s in delayed] == ["SHP-1042"]
    assert delayed[0]["destination_city"] == "Pune" and delayed[0]["cold_chain"] is True
    orders = c.get("/shipments/SHP-1042/orders").json()
    assert sorted(o["customer_id"] for o in orders) == ["CUS-101", "CUS-102", "CUS-103"]


def test_orders_not_found_and_cancel_rules(client_for):
    c = client_for("orders")
    assert c.get("/orders/ORD-0000").status_code == 404
    assert c.post("/orders/ORD-5001/cancel").status_code == 409   # in transit
    r = c.post("/orders/ORD-5005/cancel")                          # only placed
    assert r.status_code == 200 and r.json()["status"] == "cancelled"


def test_orders_create_validates_customer_and_items(client_for):
    c = client_for("orders")
    assert c.post("/orders", json={"customer_id": "CUS-999", "items": [{"sku": "MET-500", "qty": 1}]}).status_code == 404
    assert c.post("/orders", json={"customer_id": "CUS-101"}).status_code == 422
    r = c.post("/orders", json={"customer_id": "CUS-101", "items": [{"sku": "MET-500", "qty": 2}]})
    assert r.status_code == 200 and r.json()["status"] == "placed"


# ---------------------------------------------------------------- inventory

def test_inventory_low_stock_in_pune(client_for):
    low = {(r["warehouse_id"], r["sku"]) for r in client_for("inventory").get("/stock/low").json()}
    assert ("WH-PUNE", "INS-GLAR-100") in low and ("WH-PUNE", "INS-ASP-100") in low
    assert ("WH-MUM", "INS-GLAR-100") not in low


def test_inventory_availability_shows_alternative_warehouse(client_for):
    by_wh = {r["warehouse_id"]: r["available"] for r in client_for("inventory").get("/products/INS-GLAR-100/availability").json()["by_warehouse"]}
    assert by_wh["WH-MUM"] >= 300 and by_wh["WH-PUNE"] == 12


def test_inventory_reservation_cannot_exceed_stock(client_for):
    c = client_for("inventory")
    ok = c.post("/reservations", json={"warehouse_id": "WH-PUNE", "sku": "INS-GLAR-100", "qty": 10, "order_id": "ORD-1"})
    assert ok.status_code == 200
    too_much = c.post("/reservations", json={"warehouse_id": "WH-PUNE", "sku": "INS-GLAR-100", "qty": 5, "order_id": "ORD-2"})
    assert too_much.status_code == 409 and "Only 2" in too_much.json()["detail"]


def test_inventory_expiring_batches_path_and_query_forms_agree(client_for):
    c = client_for("inventory")
    a = {b["batch_id"] for b in c.get("/batches/expiring?days=30").json()}
    b = {b["batch_id"] for b in c.get("/batches/expiring-within/30").json()}
    assert a == b == {"B-AS-1190", "B-GS-0777"}


# ---------------------------------------------------------------- tickets + refunds

def test_tickets_by_customer_and_order(client_for, ledger):
    c = client_for("tickets")
    assert [t["id"] for t in c.get("/customers/CUS-103/tickets").json()] == ["TKT-9002"]
    assert [t["id"] for t in c.get("/orders/ORD-5001/tickets").json()] == ["TKT-9001"]
    assert c.get("/customers/CUS-102/tickets").json() == []


@pytest.mark.parametrize("reason,days,amount,expected", [
    ("late_delivery", 4, 35390, 8847.5),     # 25% for 4-7 days
    ("late_delivery", 2, 10000, 1000.0),     # 10% for 2-3 days
    ("damaged", 0, 1200, 1200.0),            # full refund
])
def test_refund_amount_follows_policy(client_for, ledger, reason, days, amount, expected):
    c = client_for("tickets")
    r = c.post("/refunds", json={"ticket_id": "TKT-9002", "order_id": "ORD-5003", "amount_inr": amount, "reason": reason, "days_late": days})
    assert r.status_code == 200, r.text
    assert r.json()["amount_inr"] == expected


def test_refund_guards(client_for, ledger):
    c = client_for("tickets")
    body = {"ticket_id": "TKT-9002", "order_id": "ORD-5003", "amount_inr": 35390, "reason": "late_delivery", "days_late": 4}
    assert c.post("/refunds", json=body).status_code == 200
    assert c.post("/refunds", json=body).status_code == 409                                  # no double refund
    assert c.post("/refunds", json={**body, "order_id": "X", "reason": "Late delivery"}).status_code == 422   # bad reason
    assert c.post("/refunds", json={**body, "order_id": "Y", "days_late": 1}).status_code == 422             # policy: no refund
    assert c.post("/refunds", json={**body, "order_id": "Z", "reason": "damaged", "amount_inr": 90000}).status_code == 422  # over limit
    assert c.post("/refunds", json={**body, "ticket_id": "TKT-0"}).status_code == 404
    assert [r["order_id"] for r in c.get("/refunds").json()] == ["ORD-5003"]


def test_ticket_status_is_validated(client_for):
    c = client_for("tickets")
    assert c.patch("/tickets/TKT-9001/status", json={"status": "resolved"}).json()["status"] == "resolved"
    assert c.patch("/tickets/TKT-9001/status", json={"status": "banana"}).status_code == 422


# ---------------------------------------------------------------- roster

def test_roster_oncall_and_account_manager(client_for):
    c = client_for("roster")
    west = {e["team"]: e["staff"]["name"] for e in c.get("/oncall/west").json()}
    assert west["logistics"] == "Priya Deshmukh" and west["customer_success"] == "Vikram Joshi"
    assert c.get("/customers/CUS-101/account-manager").json()["name"] == "Ananya Iyer"
    assert c.get("/oncall/north").status_code == 404


def test_roster_paging_validates_input(client_for):
    c = client_for("roster")
    assert c.post("/pages", json={"staff_id": "EMP-11", "message": "truck down"}).json()["status"] == "sent"
    assert c.post("/pages", json={"staff_id": "EMP-99", "message": "x"}).status_code == 404
    assert c.post("/pages", json={"staff_id": "EMP-11", "message": "x", "severity": "meh"}).status_code == 422


# ---------------------------------------------------------------- refund functions (the raw material for fusion)

def test_refund_functions_directly(ledger):
    assert ledger.late_delivery_share(1) == 0 and ledger.late_delivery_share(8) == 0.5
    d = ledger.check_refund_policy("cold_chain_breach", 0, 500)
    assert d == {"allowed": True, "approved_amount_inr": 500.0, "explanation": "100% of order value for cold_chain_breach"}
    entry = ledger.issue_refund("T", "O", 10, "damaged")
    assert entry["status"] == "issued" and ledger.already_refunded("T", "O")
    with pytest.raises(ValueError):
        ledger.issue_refund("T", "O", 10, "damaged")
