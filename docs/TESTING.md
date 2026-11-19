# Testing

Everything below runs locally and in CI (`.github/workflows/ci.yml`). Results from the last full local run
(Windows 11, 2026-11-20) are in the right-hand column.

| Layer | Tool | What it proves | Result |
|---|---|---|---|
| Static analysis | ruff, tsc, eslint | Python lint (E/F/W/B), TypeScript types, React/Next rules | clean |
| Security (SAST) | bandit | No high/medium findings; remaining lows are intended subprocess use | 0 high, 0 medium |
| Security (deps) | pip-audit, npm audit | No known-vulnerable dependencies | 0 vulnerabilities |
| Unit (Python) | pytest | Synapse output parsers (incl. wrapped tables), atlas search + supersede, policy, fusion learning, schema cleaning, provider routing | 15 passed |
| Component/API | pytest + FastAPI TestClient | All 4 legacy services: data, 404/409/422 paths, refund policy maths (parametrised), duplicate-refund guard | 16 passed |
| Contract | pytest + **real Synapse CLI** | Every endpoint and every path/body field in FastAPI's OpenAPI appears in Synapse's generated tools (guards Synapse bug #1) | 4 passed |
| Agent API | pytest + TestClient | `/api/state`, input validation, unknown approvals, CORS for the frontend | 4 passed |
| Integration | pytest + live services | Graft → call → prune → dormant reactivation; least privilege; human-declined writes; unknown endpoints | 3 passed |
| Performance | pytest + live services | 300 requests, 20 concurrent: p95 < 250 ms | median 64 ms, p95 153 ms |
| Unit (web) | Vitest + Testing Library | Event reducer (graft/prune/approvals/Sentinel/answers/errors), answer renderer (**escapes model HTML**), components | 11 passed |
| End-to-end | Playwright (desktop + Pixel 7) | Landing → Launch app, /console redirect, boot once, onboarding, **Replay mode with the agent server offline plays a real run to a correct answer**, approval card, offline help | 12 passed |
| Accessibility | axe-core + Playwright | WCAG 2.1 A/AA on `/` and `/app`, desktop + mobile, reduced motion | 0 serious/critical |

Python total: **43 passed**. Web: **11 unit + 16 Playwright passed**.

## Run it

```bash
# Python (unit, API, agent API, contract)
pip install pytest pytest-cov ruff bandit pip-audit
pytest -m "not integration and not perf"

# + integration and performance (needs the services: python scripts/run_services.py)
pytest

# security
bandit -q -r synaptogenesis services scripts -ll && pip-audit -r requirements.txt

# web
cd web
npx vitest run
npx playwright install chromium
npx playwright test          # builds production and serves it on :3100; the agent server is simulated offline
```

## Bugs the tests found (all fixed)

- **Accessibility:** Synapse orange on paper was 3.15:1, below WCAG AA for small text. Added `signal-ink` (#B23C14, 4.9:1) for small text. White on orange (3.65:1) → deeper orange. Dimmed "How it works" steps → solid graphite.
- **UX race (E2E):** clicking a scenario while the app was still checking for the agent server went down the Live path and silently failed. Buttons now wait for the mode; the replay pre-loader can no longer overwrite a running replay.
- **Boot overlay (E2E, mobile):** the boot screen was server-rendered and only hidden after hydration, so returning visitors on slow devices saw it and couldn't tap. An inline `<head>` script now marks returning visitors before first paint.
- **Approvals crashed in the web app** (found while recording replays): the event field `kind` collided with the event's own `kind`.
- **Security:** two `subprocess(..., shell=True)` calls (constant args) replaced with resolved paths and no shell.
- **CORS** only allowed `:3000`; now configurable (`SYNAPTO_CORS_ORIGINS`) and includes the e2e port.
- **Reduced motion:** decorative loops now stop and Motion honours the OS setting app-wide.

## Notes / known limits

- Performance numbers measure the legacy APIs with a pooled client. A new `httpx.Client` per request costs ~0.8 s on this
  Windows machine just to load the CA bundle; that was a harness artefact, not service latency.
- One Python run (under coverage, right after the E2E suite) reported a single failure that did not reproduce in 5 further
  runs (`pytest` ×2, integration+perf ×3). Logged here rather than hidden.
- The 3D canvas is excluded from axe (WebGL has no DOM text); its labels are decorative and the figure has a caption.
