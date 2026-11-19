# Synaptogenesis: agents that grow their own tools

**Track 4 (Open innovation) · built on Synapse CLI**

## The problem

Companies run on dozens of internal systems. The usual way to make them agent-ready is to pre-wire every endpoint as an
MCP tool. That has three costs:

1. **Every permission is always on.** An agent answering "who is on call?" also holds `POST /refunds`.
2. **Tools go stale.** When a developer ships a new endpoint, someone has to rebuild and reconfigure the MCP server.
3. **Agents get the wrong granularity.** Workflows like "process a refund" become chains of small calls the model has to
   assemble correctly every time.

## The idea

Synaptogenesis starts with **zero** tools. For each question it searches a *capability atlas* (built from Synapse's own
code scan), then **runs `synapse build` itself** to graft only the endpoints it needs, answers across systems, and prunes
the access when it is done. Synapse stops being a setup step and becomes the agent's nervous system.

> Every other team used Synapse to build an agent. We built an agent that uses Synapse.

## Why Synapse fits

- It turns **existing** code into MCP servers without rewriting it, in under half a second for a local Auto build,
  which is fast enough to do per question.
- `--endpoints` lets us request exactly the surface we need (least privilege).
- `--discover` keeps the surface in sync with the code (our Drift Sentinel runs it on every code change).
- `--custom -q` composes internal functions into one tool (our fusion step learns which workflows deserve it).
- Local and hosted modes both work; we use both.

## What it does (all running)

- **Just-in-time grafting** across 4 legacy services (39 endpoints), peak 4 live tools for a 3-system question.
- **Least privilege:** writes need a human at graft time and at call time; `policy.yaml` can forbid endpoints.
- **Drift Sentinel:** a new endpoint is in the atlas ~3 s after the code change and used on the next question.
- **Verified tool fusion:** repeated write workflows are fused by Synapse Custom mode, then replayed in a sandbox (the
  replay must succeed, the identical second call must be refused) before any agent may use them. This gate rejected
  Synapse's first refund tool, which issued the refund and then reported failure.
- **Free models:** Groq / OpenRouter / Gemini with rotation on rate limits.
- **Replay mode:** the web app plays recorded real runs when the agent server is not reachable.

## Honest numbers

- 3-system question on free models with prewarm: ~15 s; local Synapse build per graft ~0.4 s.
- Benchmark at 38 endpoints: pre-loading every tool is as accurate (100% vs 97%) and uses about the same tokens; JIT
  sends 5.6× less tool schema per request. The case for JIT is least privilege, freshness and verified fusion, and scale
  (hundreds of endpoints do not fit a free-tier request). See `docs/benchmark.md`.
- We found and documented **12 Synapse CLI issues** with minimal repros (`docs/synapse-issues.md`).

## Demo script (≤ 3 min)

1. **0:00** Landing: move the mouse (ink neurons), the 3D specimen grafting, "Launch app".
2. **0:20** `/app`, Live mode, prewarmed. Ask the delayed-shipment question. Point at the `synapse build` / graft lines, the
   counter going 0 → 4 → 0, and the cited answer (CUS-101/102/103, TKT-9001/9002, Priya on call).
3. **1:10** Live update: `python scripts/demo_drift.py add`. The gold node appears; ask for the revised ETA; the agent uses
   the new endpoint immediately.
4. **1:50** Refund: the approval card (human in the loop), the fused `process_refund` tool, the ledger entry.
5. **2:30** Close: the 12 Synapse findings, the test suite (43 + 27 tests, WCAG AA), the honest benchmark.
