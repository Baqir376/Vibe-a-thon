# Alignment with the Vibe-a-thon problem statement

Source: *2nd Brain Labs × Geek Room: Vibe-a-thon, Hackathon Problem Statements* (participant guide, Oct 2026).
We enter **Track 4, Open innovation**: "Build anything you like, as long as Synapse CLI is at its core: use it to turn
real code into an MCP server that an agent depends on."

## Hard requirements

| Requirement (quoted) | Status | Evidence |
|---|---|---|
| "Synapse CLI is at its core" | ✅ | The agent runs `synapse build` itself at runtime: `--auto --endpoints` (grafts), `--local` and hosted, `--discover` (Drift Sentinel), `--custom -q` (fusion). `synaptogenesis/graft.py`, `sentinel.py`, `fusion.py` |
| "turn real code into an MCP server that an agent depends on" | ✅ | 4 real FastAPI services → Synapse-built MCP servers (local passthrough files + hosted `synapse-mcp` runner); the agent has no other way to reach the data |
| Submit: "the repo" | ⏳ | Git history is clean; **push to a public GitHub repo** before 25 Nov |
| Submit: "your MCP setup" | ✅ | `docs/MCP_SETUP.md` (generated configs, hosted server ids, how to attach to Claude Desktop/Cursor) |
| Submit: "a short write-up of the problem and why Synapse fits it" | ✅ | `docs/WRITEUP.md` |
| Submit: "a demo of the agent solving it end to end" | ⏳ | **Record the video** (script in `docs/WRITEUP.md`); the app's Replay mode is a fallback that always works |
| Small sample apps are fine | ✅ | 4 services, 39 endpoints |

## Judging criteria → what we show

| Criterion | Our strongest evidence | Risk / what to do |
|---|---|---|
| **Originality and real-world value** | Agents that *grow* tools just-in-time instead of pre-wiring them; least privilege by construction; tools self-update when code changes; repeated workflows fused and **verified** before use | Lead with least privilege + live update + verified fusion. Don't claim "more accurate": our own benchmark shows parity at 38 tools (`docs/benchmark.md`) |
| **How central Synapse is** | Synapse is invoked live by the agent many times per question, in 3 modes (Auto local, Auto hosted, Custom) plus `--discover`. Remove Synapse and nothing works | Show the `synapse build` lines and timings on screen in the demo |
| **Technical execution** | Dormant connections, parallel grafts, provider rotation, sandbox verification, Drift Sentinel, replay mode, 43 Python + 27 web tests, CI, WCAG AA | Mention the 12 Synapse bugs we found and documented (`docs/synapse-issues.md`); file them as GitHub issues |
| **Quality of the demo** | Designed landing (3D specimen, ink field), live app with neural map, replay recordings | Record on a fresh Groq/OpenRouter quota day with `--prewarm`; keep it ≤ 3 min |

Tracks 1–3 are covered inside Track 4: a legacy app made agent-ready (1), Custom-mode fusion with a confirmation step
before data changes (2), cross-system questions plus a live `synapse build --discover` update (3).

## Gaps before submission (in priority order)

1. **Public GitHub repo** (and file `docs/synapse-issues.md` as issues on synapse-cli-ts).
2. **Demo video** (≤ 3 min) following the script in `docs/WRITEUP.md`.
3. **Deploy the frontend** (e.g. Vercel) so the link works for judges in Replay mode.
4. Optional: the scaling benchmark (~400 endpoints) to back the "scale" argument with numbers.
