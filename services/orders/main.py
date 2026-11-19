"""Meridian Medical Supply - Order Management Service (legacy).

Customers (clinics, pharmacies), their orders, and the shipments that carry
those orders from warehouses to customers.
"""
from __future__ import annotations

from typing import Optional

from fastapi import FastAPI, HTTPException
from pydantic import BaseModel

app = FastAPI(title="Meridian Order Management", version="3.4.0")

CUSTOMERS = [
    {"id": "CUS-101", "name": "Sahyadri Diabetes Clinic", "city": "Pune", "tier": "gold", "phone": "+91-20-5550-1101"},
    {"id": "CUS-102", "name": "Kothrud Family Pharmacy", "city": "Pune", "tier": "standard", "phone": "+91-20-5550-1102"},
    {"id": "CUS-103", "name": "Baner Endocrine Care", "city": "Pune", "tier": "silver", "phone": "+91-20-5550-1103"},
    {"id": "CUS-201", "name": "Andheri Health Hub", "city": "Mumbai", "tier": "gold", "phone": "+91-22-5550-2201"},
    {"id": "CUS-301", "name": "Indiranagar Clinic", "city": "Bengaluru", "tier": "standard", "phone": "+91-80-5550-3301"},
]

ORDERS = [
    {"id": "ORD-5001", "customer_id": "CUS-101", "items": [{"sku": "INS-GLAR-100", "qty": 40}, {"sku": "SYR-1ML", "qty": 4}], "status": "in_transit", "value_inr": 60600, "shipment_id": "SHP-1042", "placed_at": "2026-11-14T10:00:00"},
    {"id": "ORD-5002", "customer_id": "CUS-102", "items": [{"sku": "INS-GLAR-100", "qty": 15}], "status": "in_transit", "value_inr": 21750, "shipment_id": "SHP-1042", "placed_at": "2026-11-14T16:20:00"},
    {"id": "ORD-5003", "customer_id": "CUS-103", "items": [{"sku": "INS-ASP-100", "qty": 20}, {"sku": "GLU-STRIP-50", "qty": 10}], "status": "in_transit", "value_inr": 35390, "shipment_id": "SHP-1042", "placed_at": "2026-11-15T09:45:00"},
    {"id": "ORD-5004", "customer_id": "CUS-201", "items": [{"sku": "MET-500", "qty": 500}], "status": "in_transit", "value_inr": 14000, "shipment_id": "SHP-1043", "placed_at": "2026-11-16T11:00:00"},
    {"id": "ORD-4870", "customer_id": "CUS-201", "items": [{"sku": "GLU-STRIP-50", "qty": 30}], "status": "delivered", "value_inr": 26970, "shipment_id": "SHP-0991", "placed_at": "2026-10-28T10:00:00"},
    {"id": "ORD-5005", "customer_id": "CUS-301", "items": [{"sku": "GLU-STRIP-50", "qty": 12}], "status": "placed", "value_inr": 10788, "shipment_id": None, "placed_at": "2026-11-18T13:30:00"},
]

SHIPMENTS = [
    {"id": "SHP-1042", "carrier": "ColdLine Logistics", "origin_warehouse_id": "WH-MUM", "destination_city": "Pune", "cold_chain": True, "status": "delayed", "promised_date": "2026-11-17", "delay_reason": "Refrigerated truck breakdown at Lonavala; replacement vehicle pending"},
    {"id": "SHP-1043", "carrier": "BlueDart", "origin_warehouse_id": "WH-PUNE", "destination_city": "Mumbai", "cold_chain": False, "status": "on_time", "promised_date": "2026-11-20", "delay_reason": None},
    {"id": "SHP-0991", "carrier": "BlueDart", "origin_warehouse_id": "WH-PUNE", "destination_city": "Mumbai", "cold_chain": False, "status": "delivered", "promised_date": "2026-11-01", "delay_reason": None},
]


class OrderItem(BaseModel):
    sku: str
    qty: int


class OrderIn(BaseModel):
    customer_id: str
    items: list[OrderItem]


class RerouteIn(BaseModel):
    from_warehouse_id: str


def _find(rows: list[dict], key: str, kind: str) -> dict:
    row = next((r for r in rows if r["id"] == key), None)
    if not row:
        raise HTTPException(404, f"{kind} {key} not found")
    return row


@app.get("/customers")
def list_customers():
    """List all customers (clinics and pharmacies) with city and account tier."""
    return CUSTOMERS


@app.get("/customers/{customer_id}")
def get_customer(customer_id: str):
    """Get one customer by id, e.g. CUS-101: name, city, tier, phone."""
    return _find(CUSTOMERS, customer_id, "Customer")


@app.get("/customers/{customer_id}/orders")
def list_customer_orders(customer_id: str):
    """All orders placed by one customer."""
    return [o for o in ORDERS if o["customer_id"] == customer_id]


@app.get("/orders")
def list_orders(status: Optional[str] = None):
    """List all orders with status, items, value and the shipment carrying them."""
    return [o for o in ORDERS if not status or o["status"] == status]


@app.get("/orders/{order_id}")
def get_order(order_id: str):
    """Get one order by id, e.g. ORD-5001."""
    return _find(ORDERS, order_id, "Order")


@app.post("/orders")
def create_order(body: OrderIn):
    """Place a new order. Required: customer_id (CUS-*), items (list of {sku, qty})."""
    _find(CUSTOMERS, body.customer_id, "Customer")
    order = {"id": f"ORD-{5100 + len(ORDERS)}", **body.model_dump(), "status": "placed", "value_inr": 0,
             "shipment_id": None, "placed_at": "2026-11-19T12:00:00"}
    ORDERS.append(order)
    return order


@app.post("/orders/{order_id}/cancel")
def cancel_order(order_id: str):
    """Cancel an order that has not shipped yet."""
    o = _find(ORDERS, order_id, "Order")
    if o["status"] in ("in_transit", "delivered"):
        raise HTTPException(409, f"Order {order_id} is {o['status']}; cannot cancel")
    o["status"] = "cancelled"
    return o


@app.get("/shipments")
def list_shipments():
    """List all shipments with carrier, route, status, promised date and delay reason."""
    return SHIPMENTS


@app.get("/shipments/delayed")
def list_delayed_shipments():
    """Shipments that are currently delayed, with the reason for each delay."""
    return [s for s in SHIPMENTS if s["status"] == "delayed"]


@app.get("/shipments/{shipment_id}")
def get_shipment(shipment_id: str):
    """Get one shipment by id, e.g. SHP-1042."""
    return _find(SHIPMENTS, shipment_id, "Shipment")


@app.get("/shipments/{shipment_id}/orders")
def list_shipment_orders(shipment_id: str):
    """Orders (and therefore customers) carried by one shipment."""
    return [o for o in ORDERS if o["shipment_id"] == shipment_id]


@app.post("/shipments/{shipment_id}/reroute")
def reroute_shipment(shipment_id: str, body: RerouteIn):
    """Reroute a shipment to be fulfilled from a different warehouse. Required: shipment_id (path), from_warehouse_id (WH-*)."""
    s = _find(SHIPMENTS, shipment_id, "Shipment")
    s["origin_warehouse_id"] = body.from_warehouse_id
    s["status"] = "rerouted"
    return s
