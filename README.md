# Synaptogenesis

**Agents that grow the tools they need, when they need them, using Synapse.**

Every other MCP setup wires its tools in ahead of time. A company with 40 internal
services ends up with hundreds of tools. The agent struggles to pick between them,
tokens are wasted, and every permission is exposed all the time.

Synaptogenesis starts the agent with **zero business tools**. For each question it:

1. **Finds**: searches the *Capability Atlas*, an index of every endpoint in every system, built from Synapse's own code scan.
2. **Grafts**: runs `synapse build --auto --endpoints "<only what's needed>"` live, then attaches the new MCP server while the agent is running.
3. **Uses**: calls the new tools, joining facts across systems.
4. **Prunes**: drops the connection when it's done.

> Every other team used Synapse to build an agent. We built an agent that uses Synapse.

## Docs

- [`docs/WRITEUP.md`](docs/WRITEUP.md): the problem, why Synapse fits, demo script
- [`docs/MCP_SETUP.md`](docs/MCP_SETUP.md): every MCP server Synapse generates and how to attach them
- [`docs/ALIGNMENT.md`](docs/ALIGNMENT.md): requirement-by-requirement check against the problem statement
- [`docs/TESTING.md`](docs/TESTING.md): 43 Python + 27 web tests, security, accessibility, performance
- [`docs/benchmark.md`](docs/benchmark.md): pre-loaded tools vs. just-in-time, measured
- [`docs/synapse-issues.md`](docs/synapse-issues.md): 12 Synapse CLI issues with repros

## Demo company: Meridian Medical Supply (4 legacy systems, 39 endpoints)

| System | Stack | Port | Synapse mode |
|---|---|---|---|
| `orders`: customers, orders, shipments | Python / FastAPI | 8101 | hosted Auto (Synapse cloud config + `@2ndbrainlabs-ai/synapse-mcp` runner) |
| `inventory`: stock, batches, reservations, POs | Python / FastAPI | 8102 | `--local` Auto |
| `tickets`: support tickets, refunds | Python / FastAPI | 8103 | `--local` Auto (+ Custom fusion, planned) |
| `roster`: staff, account managers, on-call, paging | Python / FastAPI | 8104 | hosted Auto |

The scenario that runs through all of them: cold-chain shipment `SHP-1042` (insulin, Mumbai → Pune)
is delayed by a truck breakdown. Three Pune clinics are affected, and two of them have raised tickets.

## Quickstart

```bash
npm install -g @2ndbrainlabs-ai/synapse-cli @2ndbrainlabs-ai/synapse-mcp
pip install -r requirements.txt
cp .env.example .env                        # put SYNAPSE_API_KEY (and GROQ_API_KEY) in .env (git-ignored)
synapse config --global --key <your key>    # then: (cd services/orders && synapse init) and the same for roster

python scripts/run_services.py              # start the 4 legacy services (leave running)

python -m synaptogenesis atlas --rebuild    # Synapse scans every repo -> capability atlas
python -m synaptogenesis selftest           # graft -> call -> prune, no LLM needed

python -m synaptogenesis ask "The insulin shipment to Pune is delayed. Which customers are affected, have they raised tickets, and who is on call to handle it?"
python -m synaptogenesis chat
```

**Models: free providers work.** Put any of `GEMINI_API_KEY`, `GROQ_API_KEY`, `OPENROUTER_API_KEY` in `.env`.
Free tiers cap tokens-per-minute *per model*, so the agent rotates through every available (provider, model) pair
on a 429 instead of waiting (Gemini first, then Groq). A rejected tool call goes back to the model to fix
instead of crashing the run. With no free key it falls back to Claude (`ANTHROPIC_API_KEY`, `claude-opus-5-5`).

Useful environment variables: `SYNAPTO_PROVIDER` (pin one provider), `SYNAPTO_MODEL`, `SYNAPTO_<PROVIDER>_MODELS` (comma list), `SYNAPTO_EFFORT` (Claude only),
`SYNAPTO_AUTO_APPROVE=1|0` (skip approval prompts in scripted runs), `SYNAPTO_MODE_<SYSTEM>=local|hosted`.

## Demo runbook

```bash
python scripts/run_services.py                 # 4 legacy services; code edits restart the affected service
python -m synaptogenesis warm --reset          # Synapse pre-builds the hosted servers (read-only surface)
python -m synaptogenesis web                   # agent server + API (and the simple dashboard) on :8700
cd web && npm install && npm run dev           # the designed frontend → http://localhost:3000 (landing) and /console
#   add --prewarm for instant grafts (Synapse builds every read-only surface up front, exposing nothing)

# live update, mid-demo (the Drift Sentinel runs inside `web` and `chat`):
python scripts/demo_drift.py add               # developer ships GET /shipments/{shipment_id}/eta
python scripts/demo_drift.py remove            # reset after the rehearsal
```

Other entry points: `python -m synaptogenesis chat [--prewarm]` (terminal, Sentinel included),
`ask "<question>" [--prewarm]`, `sentinel` (watcher only), `selftest`, `atlas --rebuild`.

### What the dashboard shows
- **Live tools x / N**: tools the agent can use right now, against every endpoint in the company.
- Glowing lines: **grafted** endpoints (green = read, amber = write). Pulses: tool calls.
- Dashed lines and hollow rings: **dormant** connections after pruning (no tools exposed, instant to reactivate).
- Gold node: an endpoint the **Drift Sentinel** discovered via `synapse build --discover`.
- Approval cards: every data-changing graft and call needs a human click.

## Tool fusion: "neurons that fire together wire together"

Agents work better with one high-level tool than with a chain of small ones (Track 2's thesis).
Synaptogenesis finds those chains in the agent's own usage instead of having a human design them:

1. **Learn.** After every question the agent's calls are grouped per system. A chain with a data-changing step
   (e.g. `tickets: get_ticket > create_refund`) that recurs twice is a fusion candidate.
2. **Fuse.** `synapse build --custom --local -q "<what those steps did>"` composes ONE tool from the service's
   internal Python functions (`refunds.check_refund_policy`, `already_refunded`, `issue_refund`).
3. **Verify before trust.** The composed tool runs in a sandbox copy of the service's source (no shared data):
   the agent's own call is replayed and must succeed, and the identical second call must be refused
   (no double side effects). This gate rejected Synapse's first refund tool, which issued the refund and
   then reported "Failed to issue refund".
4. **Wire.** Only a verified tool joins the atlas, as a new system `tickets_fused`. The write step it replaces is
   superseded in search. Calling it still needs human approval.

Manual trigger: `python -m synaptogenesis fuse tickets get_ticket,create_refund --args '{...replay inputs...}'`.

## Safety

- `policy.yaml` `deny`: endpoints that can never be grafted (for example, rerouting a cold-chain shipment).
- Write endpoints (POST/PUT/PATCH/DELETE) need human approval **when grafted** and again **on every call**.
- `max_live_tools` caps the agent's working set.
- Legacy repos are never modified: Synapse's local output files are moved to `.synapto/grafts/` and deleted on prune.

## Layout

```
synaptogenesis/
  synapse_cli.py   drives the Synapse CLI non-interactively, parses its MCP snippet / endpoint table
  atlas.py         Capability Atlas: Synapse scan -> searchable endpoint index
  graft.py         just-in-time grafting: build -> attach MCP session -> prune
  agent.py         Claude tool-use loop whose tool list grows and shrinks
  events.py        JSONL event stream (.synapto/events.jsonl) for the neural-map UI + benchmark
services/          the four legacy apps (unchanged by Synapse)
systems.yaml       registry of systems; policy.yaml: least-privilege rules
```

## Measured so far

- Local graft (Python, `--local`): **~0.4 s** Synapse build + **~0.8 s** MCP connect.
- Hosted graft: **~9 s** build + **~2.5 s** connect the first time; **0 s** build + ~2.4 s connect when the hosted server already has those endpoints (cached in `.synapto/hosted_servers.json`).
- Demo question (3 systems) on free Groq models with `--prewarm`: **15 s, 7 model turns, 14k tokens**, peak 4 of 39 tools.
- Live update: endpoint added in code → in the Atlas in **~3 s** → used by the agent on the next question.
- Selftest across all 4 systems: peak **6 of 39** tools live, back to 0 after pruning.

## Synapse CLI 0.1.9 findings (to report upstream)

1. Local Auto passthrough drops **query parameters**: `GET /stock?warehouse_id=` becomes a tool with no arguments.
2. `--local --auto` checks for a model key before starting, even though plain Auto calls no model. Workaround: `SYNAPSE_LLM_PROVIDER=ollama`.
3. `.synapse/surface_cache.json` stores endpoints under the key `"undefined"` (`"files": {"undefined": {}}`).
4. Repeated local builds write `synapse_auto_server_2.py`, `_3.py`, … instead of updating the file, so the printed snippet path changes on every build.
5. Generated servers import `mcp.server.fastmcp` (gone in `mcp` 2.x) and use `from __future__ import annotations` with `Any` hints, which crashes on `mcp` 1.12 (`issubclass() arg 1 must be a class`). They work on `mcp` 1.30.
6. Passthrough tools call `raise_for_status()`, so API error bodies (e.g. `409 Only 8 units available`) never reach the agent.
7. **Hosted mode on Express (TypeScript) is unusable in practice:** routes stay in `:param` form, but runner 0.0.4 only fills in `{param}` placeholders, so tools get an empty input schema and call literal URLs like `/oncall/:region`. POST body fields from `req.body` are not detected either, so the body arrives empty. `--smart-names` doesn't help. FastAPI works correctly in hosted mode. That's why the Orders and Roster services were rewritten from Express to FastAPI.
8. The hosted MCP snippet prints `"SYNAPSE_API_KEY": "<your key>"`. Anything that copies the snippet as-is gets `401 Invalid or expired API key`.
9. Hosted Auto marks optional body fields as required (e.g. `order_id: Optional[str] = None` on `POST /tickets`).
10. **Request-body fields are silently dropped** from generated tools when the field is typed `Literal[...]` **or has a
    trailing `# comment`** (`class M(BaseModel): a: str  # note` makes `a` disappear). `POST /refunds` lost its required
    `reason`, so no agent could ever succeed with it. Minimal repro in the issue text; workaround: plain `str` with
    validation in the handler, comments on their own line.
11. Custom mode scans its **own earlier outputs** (`*_server.py` in the repo) as project source and composes new tools
    on top of them, so deleting a generated file breaks the newer one. We park stray outputs before every fusion build.
12. Custom-mode code generation is only as good as the docstrings: with undocumented return shapes it invented keys
    (`refund_amount`, `success`) that the functions never return. Documenting the returned dict fixed it.

## Roadmap

- [x] Day 1: 4 services, Atlas, graft/prune engine, policy + approvals, agent loop
- [x] Hosted grafts (Orders, Roster) + local grafts (Inventory, Tickets)
- [x] Drift Sentinel: watch repos → `synapse build --discover` → surface diff → smoke test → agent uses it
- [x] Tool fusion: Hebbian detection → `synapse build --custom` → sandbox verification → wired + supersedes the old write step
- [ ] Benchmark: all 39 tools pre-wired vs just-in-time grafting (accuracy, tokens, latency)
- [x] Neural-map dashboard (FastAPI + SSE + SVG), approvals in the UI
- [x] Designed frontend in `web/` (Next.js 16, Tailwind 4, Motion): boot sequence, landing page, live console
