"""Load/latency check of the legacy APIs the agent depends on (runs against the live services)."""
from __future__ import annotations

import statistics
import time
from concurrent.futures import ThreadPoolExecutor

import httpx
import pytest

from tests.conftest import requires_services

pytestmark = [pytest.mark.perf, requires_services]

URLS = ["http://127.0.0.1:8101/shipments/delayed", "http://127.0.0.1:8101/shipments/SHP-1042/orders",
        "http://127.0.0.1:8102/stock/low", "http://127.0.0.1:8103/customers/CUS-101/tickets", "http://127.0.0.1:8104/oncall/west"]


def test_p95_latency_under_concurrent_load():
    # One shared client, like any real caller. (A new httpx.Client per request costs ~0.8 s on Windows
    # just to load the CA bundle: that measured the test harness, not the services.)
    client = httpx.Client(timeout=5, limits=httpx.Limits(max_connections=20))
    def hit(i):
        t0 = time.perf_counter()
        r = client.get(URLS[i % len(URLS)])
        return r.status_code, (time.perf_counter() - t0) * 1000
    with ThreadPoolExecutor(max_workers=20) as pool:
        results = list(pool.map(hit, range(300)))
    client.close()
    codes = {c for c, _ in results}
    lat = sorted(ms for _, ms in results)
    p95 = lat[int(len(lat) * 0.95)]
    print(f"\n300 requests, 20 concurrent: median {statistics.median(lat):.1f} ms, p95 {p95:.1f} ms")
    assert codes == {200}
    assert p95 < 250, f"p95 {p95:.0f} ms"
