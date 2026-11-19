"""Meridian Medical Supply - Staff & On-Call Roster Service (legacy).

Who works where, which account manager owns each customer, who is on call for
each region and team today, and paging an on-call person about an incident.
"""
from __future__ import annotations

from fastapi import FastAPI, HTTPException
from pydantic import BaseModel

app = FastAPI(title="Meridian Staff & On-Call Roster", version="1.2.0")

STAFF = [
    {"id": "EMP-11", "name": "Priya Deshmukh", "team": "logistics", "region": "west", "role": "Cold-chain dispatch lead", "account_manager_for": []},
    {"id": "EMP-12", "name": "Rohan Kulkarni", "team": "logistics", "region": "west", "role": "Fleet coordinator", "account_manager_for": []},
    {"id": "EMP-21", "name": "Ananya Iyer", "team": "customer_success", "region": "west", "role": "Key account manager", "account_manager_for": ["CUS-101", "CUS-201"]},
    {"id": "EMP-22", "name": "Vikram Joshi", "team": "customer_success", "region": "west", "role": "Account manager", "account_manager_for": ["CUS-102", "CUS-103"]},
    {"id": "EMP-31", "name": "Meera Nair", "team": "customer_success", "region": "south", "role": "Account manager", "account_manager_for": ["CUS-301"]},
    {"id": "EMP-41", "name": "Farhan Shaikh", "team": "finance", "region": "west", "role": "Refund approver", "account_manager_for": []},
]

# region -> team -> staff id on call today
ON_CALL = {
    "west": {"logistics": "EMP-11", "customer_success": "EMP-22", "finance": "EMP-41"},
    "south": {"customer_success": "EMP-31"},
}

PAGES: list[dict] = []


class PageIn(BaseModel):
    staff_id: str
    message: str
    # low | high | critical
    severity: str = "high"


def _staff(staff_id: str) -> dict:
    s = next((x for x in STAFF if x["id"] == staff_id), None)
    if not s:
        raise HTTPException(404, f"Staff {staff_id} not found")
    return s


@app.get("/staff")
def list_staff():
    """List all staff with team, region, role and the customer accounts they manage."""
    return STAFF


@app.get("/staff/{staff_id}")
def get_staff(staff_id: str):
    """Get one staff member by id, e.g. EMP-21."""
    return _staff(staff_id)


@app.get("/customers/{customer_id}/account-manager")
def get_account_manager(customer_id: str):
    """The account manager responsible for a customer, e.g. CUS-101."""
    s = next((x for x in STAFF if customer_id in x["account_manager_for"]), None)
    if not s:
        raise HTTPException(404, f"No account manager for {customer_id}")
    return s


@app.get("/oncall/{region}")
def get_oncall(region: str):
    """Who is on call today in a region (west, south), for every team."""
    teams = ON_CALL.get(region)
    if teams is None:
        raise HTTPException(404, f"Unknown region {region}")
    return [{"team": team, "staff": _staff(sid)} for team, sid in teams.items()]


@app.post("/pages")
def page_staff(body: PageIn):
    """Page (alert) a staff member about an incident; sends a real notification. Required: staff_id (EMP-*), message. Optional: severity (low|high|critical, default high)."""
    if body.severity not in {"low", "high", "critical"}:
        raise HTTPException(422, f"severity must be low, high or critical, got {body.severity!r}")
    _staff(body.staff_id)
    page = {"id": f"PG-{600 + len(PAGES)}", **body.model_dump(), "status": "sent"}
    PAGES.append(page)
    return page


@app.get("/pages")
def list_pages():
    """List pages that were sent, with acknowledgement status."""
    return PAGES
