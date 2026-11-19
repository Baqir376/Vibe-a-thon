"""Meridian Medical Supply - Warehouse & Inventory Service (legacy).

Tracks stock levels per warehouse, lot batches with expiry dates, reorder
thresholds, stock reservations for orders and draft purchase orders.
"""
from __future__ import annotations

from datetime import date, timedelta
from typing import Optional

from fastapi import FastAPI, HTTPException
from pydantic import BaseModel

app = FastAPI(title="Meridian Inventory Service", version="2.3.1")

TODAY = date(2026, 11, 19)

PRODUCTS = {
    "INS-GLAR-100": {"sku": "INS-GLAR-100", "name": "Insulin Glargine 100U/mL (10mL vial)", "cold_chain": True, "unit_price_inr": 1450},
    "INS-ASP-100": {"sku": "INS-ASP-100", "name": "Insulin Aspart 100U/mL (10mL vial)", "cold_chain": True, "unit_price_inr": 1320},
    "MET-500": {"sku": "MET-500", "name": "Metformin 500mg (strip of 10)", "cold_chain": False, "unit_price_inr": 28},
    "SYR-1ML": {"sku": "SYR-1ML", "name": "Insulin syringe 1mL (box of 100)", "cold_chain": False, "unit_price_inr": 650},
    "GLU-STRIP-50": {"sku": "GLU-STRIP-50", "name": "Glucose test strips (pack of 50)", "cold_chain": False, "unit_price_inr": 899},
}

WAREHOUSES = {
    "WH-PUNE": {"id": "WH-PUNE", "city": "Pune", "region": "west", "cold_storage": True},
    "WH-MUM": {"id": "WH-MUM", "city": "Mumbai", "region": "west", "cold_storage": True},
    "WH-BLR": {"id": "WH-BLR", "city": "Bengaluru", "region": "south", "cold_storage": False},
}

# (warehouse, sku) -> list of batches
BATCHES = [
    {"batch_id": "B-GL-2207", "warehouse_id": "WH-PUNE", "sku": "INS-GLAR-100", "qty": 12, "expiry": "2027-03-01"},
    {"batch_id": "B-GL-2311", "warehouse_id": "WH-MUM", "sku": "INS-GLAR-100", "qty": 340, "expiry": "2027-06-15"},
    {"batch_id": "B-AS-1190", "warehouse_id": "WH-PUNE", "sku": "INS-ASP-100", "qty": 8, "expiry": "2026-12-04"},
    {"batch_id": "B-AS-1204", "warehouse_id": "WH-MUM", "sku": "INS-ASP-100", "qty": 120, "expiry": "2027-02-20"},
    {"batch_id": "B-MT-0091", "warehouse_id": "WH-PUNE", "sku": "MET-500", "qty": 5400, "expiry": "2028-01-01"},
    {"batch_id": "B-SY-0410", "warehouse_id": "WH-PUNE", "sku": "SYR-1ML", "qty": 35, "expiry": "2030-01-01"},
    {"batch_id": "B-GS-0777", "warehouse_id": "WH-BLR", "sku": "GLU-STRIP-50", "qty": 60, "expiry": "2026-12-10"},
    {"batch_id": "B-GS-0781", "warehouse_id": "WH-PUNE", "sku": "GLU-STRIP-50", "qty": 410, "expiry": "2027-08-30"},
]

REORDER_THRESHOLDS = {"INS-GLAR-100": 50, "INS-ASP-100": 40, "MET-500": 1000, "SYR-1ML": 60, "GLU-STRIP-50": 100}

RESERVATIONS: list[dict] = []
PURCHASE_ORDERS: list[dict] = []


class ReservationIn(BaseModel):
    warehouse_id: str
    sku: str
    qty: int
    order_id: str


class PurchaseOrderLine(BaseModel):
    sku: str
    qty: int


class PurchaseOrderIn(BaseModel):
    warehouse_id: str
    lines: list[PurchaseOrderLine]
    note: Optional[str] = None


def _available(warehouse_id: str, sku: str) -> int:
    on_hand = sum(b["qty"] for b in BATCHES if b["warehouse_id"] == warehouse_id and b["sku"] == sku)
    reserved = sum(r["qty"] for r in RESERVATIONS if r["warehouse_id"] == warehouse_id and r["sku"] == sku)
    return on_hand - reserved


@app.get("/products")
def list_products():
    """List every product in the catalogue with price and cold-chain flag."""
    return list(PRODUCTS.values())


@app.get("/products/{sku}")
def get_product(sku: str):
    """Get one product by SKU."""
    if sku not in PRODUCTS:
        raise HTTPException(404, f"Unknown SKU {sku}")
    return PRODUCTS[sku]


@app.get("/warehouses")
def list_warehouses():
    """List warehouses with city, region and whether they have cold storage."""
    return list(WAREHOUSES.values())


@app.get("/stock")
def get_stock(warehouse_id: Optional[str] = None, sku: Optional[str] = None):
    """Available stock (on hand minus reservations) per warehouse and SKU. Filter by warehouse_id and/or sku."""
    rows = []
    for wh in WAREHOUSES:
        if warehouse_id and wh != warehouse_id:
            continue
        for s in PRODUCTS:
            if sku and s != sku:
                continue
            rows.append({"warehouse_id": wh, "sku": s, "available": _available(wh, s), "reorder_threshold": REORDER_THRESHOLDS[s]})
    return rows


@app.get("/stock/low")
def get_low_stock(warehouse_id: Optional[str] = None):
    """Items whose available stock is below the reorder threshold, with the shortfall."""
    out = []
    for row in get_stock(warehouse_id=warehouse_id):
        if row["available"] < row["reorder_threshold"]:
            out.append({**row, "shortfall": row["reorder_threshold"] - row["available"]})
    return out


@app.get("/warehouses/{warehouse_id}/stock")
def get_warehouse_stock(warehouse_id: str):
    """Available stock of every SKU in one warehouse (e.g. WH-PUNE)."""
    if warehouse_id not in WAREHOUSES:
        raise HTTPException(404, f"Unknown warehouse {warehouse_id}")
    return get_stock(warehouse_id=warehouse_id)


@app.get("/products/{sku}/availability")
def get_sku_availability(sku: str):
    """Where a SKU is available: stock per warehouse, so shortages can be covered from another warehouse."""
    if sku not in PRODUCTS:
        raise HTTPException(404, f"Unknown SKU {sku}")
    return {"product": PRODUCTS[sku], "by_warehouse": get_stock(sku=sku)}


@app.get("/batches/expiring")
def get_expiring_batches(days: int = 30):
    """Batches that expire within the given number of days."""
    cutoff = TODAY + timedelta(days=days)
    return [b for b in BATCHES if date.fromisoformat(b["expiry"]) <= cutoff]


@app.get("/batches/expiring-within/{days}")
def get_batches_expiring_within(days: int):
    """Batches that expire within the given number of days (path form)."""
    return get_expiring_batches(days=days)


@app.post("/reservations")
def create_reservation(body: ReservationIn):
    """Reserve stock for a customer order. Required: warehouse_id (WH-PUNE|WH-MUM|WH-BLR), sku, qty (integer), order_id (ORD-*). Fails if not enough is available."""
    avail = _available(body.warehouse_id, body.sku)
    if body.qty > avail:
        raise HTTPException(409, f"Only {avail} units of {body.sku} available in {body.warehouse_id}")
    res = {"reservation_id": f"RSV-{len(RESERVATIONS) + 1:04d}", **body.model_dump()}
    RESERVATIONS.append(res)
    return res


@app.get("/reservations")
def list_reservations(order_id: Optional[str] = None):
    """List stock reservations, optionally for one order."""
    return [r for r in RESERVATIONS if not order_id or r["order_id"] == order_id]


@app.post("/purchase-orders")
def create_purchase_order(body: PurchaseOrderIn):
    """Create a DRAFT purchase order to restock a warehouse (not sent to suppliers). Required: warehouse_id (WH-*), lines (list of {sku, qty}). Optional: note."""
    for line in body.lines:
        if line.sku not in PRODUCTS:
            raise HTTPException(404, f"Unknown SKU {line.sku}")
    po = {"po_id": f"PO-{len(PURCHASE_ORDERS) + 7001}", "status": "draft", **body.model_dump(),
          "total_inr": sum(PRODUCTS[ln.sku]["unit_price_inr"] * ln.qty for ln in body.lines)}
    PURCHASE_ORDERS.append(po)
    return po
