"""Live-update demo: play the developer who ships a new endpoint mid-demo.

    python scripts/demo_drift.py add      # adds GET /shipments/{shipment_id}/eta to the Orders service
    python scripts/demo_drift.py remove   # takes it out again (reset before a rehearsal)

The Orders service reloads on save; the Drift Sentinel notices the change, reruns
`synapse build --discover`, and the agent can use the new endpoint on its next question.
"""
from __future__ import annotations

import sys
from pathlib import Path

TARGET = Path(__file__).resolve().parent.parent / "services" / "orders" / "main.py"
BEGIN, END = "# --- demo: eta endpoint (begin) ---", "# --- demo: eta endpoint (end) ---"
SNIPPET = f'''

{BEGIN}
REVISED_ETAS = {{
    "SHP-1042": {{"revised_eta": "2026-11-20T14:00:00+05:30", "confidence": "high",
                 "update": "Replacement reefer truck dispatched from Mumbai at 06:10; cold chain verified at 4.1 C"}},
    "SHP-1043": {{"revised_eta": "2026-11-20T11:00:00+05:30", "confidence": "high", "update": "On schedule"}},
}}


@app.get("/shipments/{{shipment_id}}/eta")
def get_shipment_eta(shipment_id: str):
    """Live revised ETA for a shipment from the carrier feed, with confidence and the latest update."""
    _find(SHIPMENTS, shipment_id, "Shipment")
    eta = REVISED_ETAS.get(shipment_id)
    if not eta:
        raise HTTPException(404, f"No carrier ETA yet for {{shipment_id}}")
    return {{"shipment_id": shipment_id, **eta}}
{END}
'''


def main() -> None:
    action = sys.argv[1] if len(sys.argv) > 1 else "add"
    src = TARGET.read_text(encoding="utf-8")
    if action == "add":
        if BEGIN in src:
            print("ETA endpoint already present.")
            return
        TARGET.write_text(src.rstrip("\n") + "\n" + SNIPPET, encoding="utf-8")
        print("Added GET /shipments/{shipment_id}/eta to services/orders/main.py")
    elif action == "remove":
        if BEGIN not in src:
            print("ETA endpoint not present.")
            return
        start, end = src.index(BEGIN), src.index(END) + len(END)
        TARGET.write_text(src[:start].rstrip("\n") + "\n" + src[end:].lstrip("\n"), encoding="utf-8")
        print("Removed the ETA endpoint from services/orders/main.py")
    else:
        sys.exit("usage: demo_drift.py add|remove")


if __name__ == "__main__":
    main()
