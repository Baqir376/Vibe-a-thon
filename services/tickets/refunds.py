"""Refund policy and ledger. Internal functions used by the ticket service.

These small functions are the raw material for a composed Synapse Custom-mode
tool ("process a refund end to end").
"""
from __future__ import annotations

LEDGER: list[dict] = []

# Policy: share of order value refundable per reason; late deliveries scale by days late.
POLICY = {
    "damaged": 1.0,
    "wrong_item": 1.0,
    "cold_chain_breach": 1.0,
    "late_delivery": None,  # computed
    "other": 0.0,
}
MAX_AUTO_REFUND_INR = 50_000


def late_delivery_share(days_late: int) -> float:
    """Refundable share of the order value for a late delivery."""
    if days_late <= 1:
        return 0.0
    if days_late <= 3:
        return 0.10
    if days_late <= 7:
        return 0.25
    return 0.50


def check_refund_policy(reason: str, days_late: int, amount_inr: float) -> dict:
    """Decide whether a refund is allowed and for how much."""
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
    """True if this ticket/order already has a refund (prevents double refunds)."""
    return any(r["ticket_id"] == ticket_id and r["order_id"] == order_id for r in LEDGER)


def issue_refund(ticket_id: str, order_id: str, amount_inr: float, reason: str) -> dict:
    """Record a refund in the ledger. Refuses duplicates."""
    if already_refunded(ticket_id, order_id):
        raise ValueError(f"Order {order_id} already refunded on {ticket_id}")
    entry = {"refund_id": f"RF-{len(LEDGER) + 3001}", "ticket_id": ticket_id, "order_id": order_id, "amount_inr": amount_inr, "reason": reason, "status": "issued"}
    LEDGER.append(entry)
    return entry
