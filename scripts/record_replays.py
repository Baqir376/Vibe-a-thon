"""Record real agent runs as replay files for the web app's Replay mode.

Requires the agent server (python -m synaptogenesis web --prewarm) and the services to be running.

    python scripts/record_replays.py            # all scenarios
    python scripts/record_replays.py delayed    # one scenario

Each replay = the /api/state snapshot at the start + every event of the run with its original timing.
Approvals are granted automatically during recording (and shown as approved in the replay).
"""
from __future__ import annotations

import json
import subprocess
import sys
import threading
import time
from pathlib import Path

import httpx

ROOT = Path(__file__).resolve().parent.parent
API = "http://127.0.0.1:8700"
OUT = ROOT / "web" / "public" / "replays"

SCENARIOS = {
    "delayed": {
        "title": "Delayed shipment impact",
        "blurb": "One question spans orders, tickets and the on-call roster. Watch three systems get grafted and pruned.",
        "question": "The insulin shipment to Pune is delayed. Which customers are affected, have they raised support tickets, and who is on call to handle it?",
    },
    "refund": {
        "title": "Process a refund",
        "blurb": "Uses the verified tool Synapse fused from the refund workflow. Every data change asks a human first.",
        "question": "Process a refund for ticket TKT-9002 (order ORD-5003, order value 35390 INR): the delivery was 4 days late.",
        "before": "reset_ledger",
    },
    "live-update": {
        "title": "Live update (Drift Sentinel)",
        "blurb": "A developer ships a new endpoint. The Sentinel reruns synapse --discover and the agent uses it straight away.",
        "question": "Is there a revised delivery ETA for the delayed Pune insulin shipment SHP-1042? Answer in 2 lines.",
        "before": "add_endpoint",
        "after": "remove_endpoint",
    },
}


def listen(events: list, stop: threading.Event, ready: threading.Event) -> None:
    with httpx.Client(timeout=None) as c:  # nosec B113 - long-lived SSE stream to the local agent server
        with c.stream("GET", f"{API}/api/events") as r:
            ready.set()
            for line in r.iter_lines():
                if stop.is_set():
                    return
                if not line.startswith("data: "):
                    continue
                ev = json.loads(line[6:])
                events.append(ev)
                if ev["kind"] == "approval.request":  # recording: approve automatically
                    httpx.post(f"{API}/api/approve", json={"id": ev["id"], "approved": True})


def wait_for(events: list, kinds: set, timeout: float, since: int = 0) -> dict | None:
    t0 = time.time()
    while time.time() - t0 < timeout:
        for ev in events[since:]:
            if ev["kind"] in kinds:
                return ev
        time.sleep(0.2)
    return None


def record(sid: str) -> None:
    sc = SCENARIOS[sid]
    events: list = []
    stop, ready = threading.Event(), threading.Event()
    th = threading.Thread(target=listen, args=(events, stop, ready), daemon=True)
    th.start()
    ready.wait(10)
    state = httpx.get(f"{API}/api/state").json()

    if sc.get("before") == "reset_ledger":
        (ROOT / "services" / "tickets" / "refund_ledger.json").unlink(missing_ok=True)
    if sc.get("before") == "add_endpoint":
        subprocess.run([sys.executable, str(ROOT / "scripts" / "demo_drift.py"), "add"], check=True)
        if not wait_for(events, {"drift"}, 60):
            raise SystemExit("Sentinel did not report the new endpoint (is the agent server running?)")
        time.sleep(4)  # let the Orders service restart with the new route

    start = len(events) if sc.get("before") != "add_endpoint" else 0
    r = httpx.post(f"{API}/api/ask", json={"question": sc["question"]})
    r.raise_for_status()
    end = wait_for(events, {"answer.text", "answer.error"}, 600, start)
    time.sleep(0.5)
    stop.set()
    if sc.get("after") == "remove_endpoint":
        subprocess.run([sys.executable, str(ROOT / "scripts" / "demo_drift.py"), "remove"], check=True)
    if not end or end["kind"] != "answer.text":
        raise SystemExit(f"{sid}: run did not finish cleanly: {end}")

    run = [e for e in events[start:]]
    t0 = run[0]["ts"]
    OUT.mkdir(parents=True, exist_ok=True)
    out = {"id": sid, "title": sc["title"], "blurb": sc["blurb"], "question": sc["question"],
           "recorded_at": time.strftime("%Y-%m-%d %H:%M"), "state": state,
           "events": [{**e, "t": round(e["ts"] - t0, 3)} for e in run]}
    (OUT / f"{sid}.json").write_text(json.dumps(out, indent=1), encoding="utf-8")
    print(f"recorded {sid}: {len(run)} events, {out['events'][-1]['t']:.1f}s, answer: {end['text'][:90]!r}")


if __name__ == "__main__":
    sys.stdout.reconfigure(encoding="utf-8")
    for sid in (sys.argv[1:] or list(SCENARIOS)):
        record(sid)
        time.sleep(15)  # let free-tier model limits refill between recordings
    index = [{k: json.loads((OUT / f"{s}.json").read_text(encoding="utf-8"))[k] for k in ("id", "title", "blurb", "question")}
             for s in SCENARIOS if (OUT / f"{s}.json").exists()]
    (OUT / "index.json").write_text(json.dumps(index, indent=1), encoding="utf-8")
    print("index:", [i["id"] for i in index])
