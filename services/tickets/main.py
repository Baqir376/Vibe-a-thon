"""Meridian Medical Supply - Customer Support Ticket Service (legacy).

Support tickets raised by clinics and pharmacies, comments, status changes,
and refunds governed by the company refund policy.
"""
from __future__ import annotations

from typing import Optional

from fastapi import FastAPI, HTTPException
from pydantic import BaseModel

import refunds

app = FastAPI(title="Meridian Support Tickets", version="1.8.0")

TICKETS: dict[str, dict] = {
    "TKT-9001": {"id": "TKT-9001", "customer_id": "CUS-101", "order_id": "ORD-5001", "subject": "Insulin glargine not delivered - patients waiting",
                 "priority": "high", "status": "open", "created": "2026-11-18T09:12:00", "comments": [
                     {"author": "customer", "text": "We have 14 patients due for refills tomorrow. Please advise ETA."}]},
    "TKT-9002": {"id": "TKT-9002", "customer_id": "CUS-103", "order_id": "ORD-5003", "subject": "Where is our cold-chain order?",
                 "priority": "medium", "status": "open", "created": "2026-11-18T15:40:00", "comments": []},
    "TKT-8950": {"id": "TKT-8950", "customer_id": "CUS-201", "order_id": "ORD-4870", "subject": "Wrong strip count in pack",
                 "priority": "low", "status": "resolved", "created": "2026-11-02T11:00:00", "comments": []},
    "TKT-8991": {"id": "TKT-8991", "customer_id": "CUS-301", "order_id": None, "subject": "Request for updated price list",
                 "priority": "low", "status": "open", "created": "2026-11-15T10:05:00", "comments": []},
}


PRIORITIES = {"low", "medium", "high", "urgent"}
STATUSES = {"open", "pending", "resolved", "closed"}
REASONS = {"late_delivery", "damaged", "wrong_item", "cold_chain_breach", "other"}


def _check(value: str, allowed: set[str], field: str) -> None:
    if value not in allowed:
        raise HTTPException(422, f"{field} must be one of {sorted(allowed)}, got {value!r}")


class TicketIn(BaseModel):
    customer_id: str
    subject: str
    # low | medium | high | urgent
    priority: str = "medium"
    order_id: Optional[str] = None


class CommentIn(BaseModel):
    author: str
    text: str


class StatusIn(BaseModel):
    # open | pending | resolved | closed
    status: str


class RefundIn(BaseModel):
    ticket_id: str
    order_id: str
    amount_inr: float
    # late_delivery | damaged | wrong_item | cold_chain_breach | other
    reason: str
    days_late: int = 0


@app.get("/tickets")
def list_tickets(customer_id: Optional[str] = None, status: Optional[str] = None, order_id: Optional[str] = None):
    """List support tickets. Filter by customer_id, order_id and/or status."""
    out = list(TICKETS.values())
    if customer_id:
        out = [t for t in out if t["customer_id"] == customer_id]
    if order_id:
        out = [t for t in out if t["order_id"] == order_id]
    if status:
        out = [t for t in out if t["status"] == status]
    return out


@app.get("/customers/{customer_id}/tickets")
def list_customer_tickets(customer_id: str):
    """All support tickets raised by one customer (e.g. CUS-101), any status."""
    return list_tickets(customer_id=customer_id)


@app.get("/orders/{order_id}/tickets")
def list_order_tickets(order_id: str):
    """All support tickets that reference one order (e.g. ORD-5001)."""
    return list_tickets(order_id=order_id)


@app.get("/tickets/{ticket_id}")
def get_ticket(ticket_id: str):
    """Get one ticket with its comment thread."""
    if ticket_id not in TICKETS:
        raise HTTPException(404, f"Ticket {ticket_id} not found")
    return TICKETS[ticket_id]


@app.post("/tickets")
def create_ticket(body: TicketIn):
    """Open a new support ticket. Required: customer_id (CUS-*), subject. Optional: priority (low|medium|high|urgent, default medium), order_id (ORD-*)."""
    _check(body.priority, PRIORITIES, "priority")
    tid = f"TKT-{9000 + len(TICKETS) + 1}"
    TICKETS[tid] = {"id": tid, **body.model_dump(), "status": "open", "created": "2026-11-19T12:00:00", "comments": []}
    return TICKETS[tid]


@app.post("/tickets/{ticket_id}/comments")
def add_comment(ticket_id: str, body: CommentIn):
    """Add a comment to a ticket (e.g. an update to the customer). Required: ticket_id (path), author (e.g. "support"), text."""
    t = get_ticket(ticket_id)
    t["comments"].append(body.model_dump())
    return t


@app.patch("/tickets/{ticket_id}/status")
def set_ticket_status(ticket_id: str, body: StatusIn):
    """Change a ticket's status. Required: ticket_id (path), status (open|pending|resolved|closed)."""
    _check(body.status, STATUSES, "status")
    t = get_ticket(ticket_id)
    t["status"] = body.status
    return t


@app.post("/refunds")
def create_refund(body: RefundIn):
    """Issue a refund for a ticket; the refund policy computes the refundable amount. Required: ticket_id (TKT-*), order_id (ORD-*), amount_inr (the FULL order value, number), reason (exactly one of: late_delivery, damaged, wrong_item, cold_chain_breach, other). For late_delivery also pass days_late (integer). Refuses duplicates and amounts above the auto-refund limit."""
    _check(body.reason, REASONS, "reason")
    get_ticket(body.ticket_id)
    decision = refunds.check_refund_policy(body.reason, body.days_late, body.amount_inr)
    if not decision["allowed"]:
        raise HTTPException(422, decision["explanation"])
    try:
        return refunds.issue_refund(body.ticket_id, body.order_id, decision["approved_amount_inr"], body.reason)
    except ValueError as e:
        raise HTTPException(409, str(e))


@app.get("/refunds")
def list_refunds(ticket_id: Optional[str] = None):
    """List refunds already issued, optionally for one ticket."""
    return refunds.list_refunds(ticket_id)
