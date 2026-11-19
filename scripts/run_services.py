"""Start all four Meridian legacy services and keep them running until Ctrl-C.

    python scripts/run_services.py

A developer's code change goes live immediately: the launcher watches each
service's .py files and restarts only that service (the Drift Sentinel demo relies
on this). Synapse's generated synapse_auto_server*.py files are ignored, so a graft
never restarts a service. (uvicorn --reload hangs on Windows, hence this watcher.)
"""
from __future__ import annotations

import os
import subprocess
import sys
import time
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SERVICES = [  # name, port, health probe
    ("orders", 8101, "/shipments"),
    ("inventory", 8102, "/products"),
    ("tickets", 8103, "/tickets"),
    ("roster", 8104, "/staff"),
]


def up(port: int, probe: str) -> bool:
    try:
        with urllib.request.urlopen(f"http://127.0.0.1:{port}{probe}", timeout=1) as r:
            return r.status == 200
    except Exception:
        return False


def fingerprint(path: Path) -> dict[str, float]:
    return {str(f): f.stat().st_mtime for f in path.glob("*.py") if not f.name.startswith("synapse_auto_server")}


def start(name: str, port: int) -> subprocess.Popen:
    log = open(ROOT / ".synapto" / f"{name}.log", "a", encoding="utf-8")
    return subprocess.Popen([sys.executable, "-m", "uvicorn", "main:app", "--port", str(port)],
                            cwd=ROOT / "services" / name, stdout=log, stderr=subprocess.STDOUT,
                            env={**os.environ, "PORT": str(port)})


def wait_up(port: int, probe: str, timeout: float = 30) -> bool:
    deadline = time.time() + timeout
    while time.time() < deadline:
        if up(port, probe):
            return True
        time.sleep(0.3)
    return False


def main() -> None:
    procs: dict[str, subprocess.Popen] = {}
    prints: dict[str, dict] = {}
    for name, port, probe in SERVICES:
        if up(port, probe):
            print(f"  {name:10} already running on :{port} (not managed: no auto-restart)")
            continue
        procs[name] = start(name, port)
        prints[name] = fingerprint(ROOT / "services" / name)
    for name, port, probe in SERVICES:
        print(f"  {name:10} {'UP' if wait_up(port, probe) else 'FAILED'}  http://127.0.0.1:{port}", flush=True)
    if not procs:
        return
    print("Services running; code changes restart the affected service. Ctrl-C to stop.", flush=True)
    try:
        while True:
            time.sleep(0.7)
            for name, port, probe in SERVICES:
                if name not in procs:
                    continue
                fp = fingerprint(ROOT / "services" / name)
                if fp != prints[name]:
                    time.sleep(0.3)  # let the editor finish writing
                    prints[name] = fingerprint(ROOT / "services" / name)
                    procs[name].terminate()
                    procs[name].wait(timeout=10)
                    procs[name] = start(name, port)
                    ok = wait_up(port, probe)
                    print(f"  {name:10} code changed -> restarted {'OK' if ok else 'FAILED (see .synapto/' + name + '.log)'}",
                          flush=True)
    except KeyboardInterrupt:
        for p in procs.values():
            p.terminate()


if __name__ == "__main__":
    (ROOT / ".synapto").mkdir(exist_ok=True)
    main()
