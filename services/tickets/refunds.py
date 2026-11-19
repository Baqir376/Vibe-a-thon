"""Refund policy and ledger. Internal functions used by the ticket service.

These small functions are the raw material for a composed Synapse Custom-mode
tool ("process a refund end to end"). The ledger is a JSON file so every process
that imports this module (the API and any composed tool) sees the same refunds.
"""
from __future__ import annotations

import json
import os
from pathlib import Path

LEDGER_FILE = Path(os.environ.get("REFUND_LEDGER", Path(__file__).with_name("refund_ledger.json")))

# Policy: share of order value refundable per reason; late deliveries scale by days late.
POLICY = {
    "damaged": 1.0,
    "wrong_item": 1.0,
    "cold_chain_breach": 1.0,
    "late_delivery": None,  # computed by late_delivery_share
    "other": 0.0,
}
MAX_AUTO_REFUND_INR = 50_000


def _load() -> list[dict]:
    try:
        return json.loads(LEDGER_FILE.read_text(encoding="utf-8"))
    except (OSError, ValueError):
        return []


def _save(entries: list[dict]) -> None:
    LEDGER_FILE.write_text(json.dumps(entries, indent=1), encoding="utf-8")


def list_refunds(ticket_id: str | None = None) -> list[dict]:
    """All refunds in the ledger, optionally only those for one ticket.

    Returns a list of dicts: {refund_id, ticket_id, order_id, amount_inr, reason, status}.
    """
    return [r for r in _load() if not ticket_id or r["ticket_id"] == ticket_id]


def late_delivery_share(days_late: int) -> float:
    """Refundable share (0.0-1.0) of the order value for a late delivery.

    <=1 day: 0.0, 2-3 days: 0.10, 4-7 days: 0.25, more than 7 days: 0.50.
    """
    if days_late <= 1:
        return 0.0
    if days_late <= 3:
        return 0.10
    if days_late <= 7:
        return 0.25
    return 0.50


def check_refund_policy(reason: str, days_late: int, amount_inr: float) -> dict:
    """Decide whether a refund is allowed and for how much.

    reason: one of damaged, wrong_item, cold_chain_breach, late_delivery, other.
    Returns {"allowed": bool, "approved_amount_inr": float, "explanation": str}.
    When allowed is True, approved_amount_inr is the exact amount to refund.
    """
    if reason not in POLICY:
        return {"allowed": False, "approved_amount_inr": 0, "explanation": f"Unknown reason {reason}"}
    share = late_delivery_share(days_late) if reason == "late_delivery" else POLICY[reason]
    approved = round(amount_inr * share, 2)
    if approved <= 0:
        return {"allowed": False, "approved_amount_inr": 0, "explanation": f"Policy gives no refund for {reason} ({days_late} days late)"}
    if approved > MAX_AUTO_REFUND_INR:
        return {"allowed": False, "approved_amount_inr": approved, "explanation": f"INR {approved} exceeds auto-refund limit {MAX_AUTO_REFUND_INR}; needs finance approval"}
    return {"allowed": True, "approved_amount_inr": approved, "explanation": f"{int(share * 100)}% of order value for {reason}"}


def already_refunded(ticket_id: str, order_id: str) -> bool:
    """True if this ticket/order pair already has a refund (prevents double refunds)."""
    return any(r["ticket_id"] == ticket_id and r["order_id"] == order_id for r in _load())


def issue_refund(ticket_id: str, order_id: str, amount_inr: float, reason: str) -> dict:
    """Record a refund in the ledger and return the ledger entry.

    Returns {"refund_id": str, "ticket_id": str, "order_id": str, "amount_inr": float,
    "reason": str, "status": "issued"}. Raises ValueError if this ticket/order was already refunded.
    """
    entries = _load()
    if any(r["ticket_id"] == ticket_id and r["order_id"] == order_id for r in entries):
        raise ValueError(f"Order {order_id} already refunded on {ticket_id}")
    entry = {"refund_id": f"RF-{len(entries) + 3001}", "ticket_id": ticket_id, "order_id": order_id,
             "amount_inr": amount_inr, "reason": reason, "status": "issued"}
    entries.append(entry)
    _save(entries)
    return entry
