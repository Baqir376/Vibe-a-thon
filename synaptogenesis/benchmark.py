"""Benchmark: classic "every tool pre-loaded" MCP setup vs. just-in-time grafting.

    python -m synaptogenesis bench [--tasks 6] [--modes static,jit]

Same questions, same models, same services. Each answer is scored against facts that
are known to be true in the seed data. Results go to .synapto/bench/ and docs/benchmark.md.
"""
from __future__ import annotations

import asyncio
import json
import statistics
import time
from pathlib import Path

from .agent import Agent
from .atlas import Atlas
from .config import ROOT, STATE_DIR, load_policy, load_systems
from .graft import GraftManager

TASKS = [
    {"id": "delay-impact", "systems": 3,
     "q": "The insulin shipment to Pune is delayed. Which customers are affected, have they raised support tickets, and who is on call in logistics to handle it?",
     "expect": ["CUS-101", "CUS-102", "CUS-103", "TKT-9001", "TKT-9002", "Priya"]},
    {"id": "low-stock", "systems": 1,
     "q": "Which insulin products are below their reorder threshold in the Pune warehouse, and which other warehouse has enough of each to cover it?",
     "expect": ["INS-GLAR-100", "INS-ASP-100", "WH-MUM"]},
    {"id": "account-manager", "systems": 2,
     "q": "Who is the account manager for Sahyadri Diabetes Clinic, and what is their role?",
     "expect": ["Ananya", "Key account manager"]},
    {"id": "expiring", "systems": 1,
     "q": "Which stock batches expire within the next 30 days? Give batch ids and warehouses.",
     "expect": ["B-AS-1190", "B-GS-0777", "WH-PUNE", "WH-BLR"]},
    {"id": "customer-tickets", "systems": 2,
     "q": "Baner Endocrine Care is unhappy. What are their open support tickets and which of their orders is still in transit?",
     "expect": ["TKT-9002", "ORD-5003"]},
    {"id": "south-oncall", "systems": 1,
     "q": "Who is on call for customer success in the south region today?",
     "expect": ["Meera"]},
]


def score(answer: str, expect: list[str]) -> float:
    a = answer.lower().replace("‑", "-")
    return sum(e.lower() in a for e in expect) / len(expect)


async def _decline(kind: str, detail: dict) -> bool:
    return kind == "graft"  # static setup may expose everything; no data-changing call is ever executed


async def run_mode(mode: str, tasks: list[dict]) -> list[dict]:
    systems = load_systems()
    atlas = Atlas.load_or_build(systems)
    policy = load_policy()
    if mode == "static":
        policy.max_live_tools = 1000
    gm = GraftManager(systems, atlas, policy, _decline)
    out = []
    try:
        await gm.prewarm()  # equal footing: connections already open in both modes
        if mode == "static":
            reqs = [{"system": s, "endpoints": [c.spec for c in atlas.caps if c.system == s
                                                and not policy.denied(s, c.method, c.path)], "reason": "static"}
                    for s in systems]
            await gm.graft_many(reqs)
        for t in tasks:
            agent = Agent(gm, atlas, auto_prune=(mode != "static"), static=(mode == "static"))
            t0 = time.perf_counter()
            try:
                s = await agent.ask(t["q"])
                row = {"task": t["id"], "mode": mode, "score": score(s.answer, t["expect"]), "turns": s.turns,
                       "tool_calls": s.tool_calls, "failed_calls": s.failed_calls, "input_tokens": s.input_tokens,
                       "output_tokens": s.output_tokens, "seconds": s.seconds, "peak_tools": s.peak_live_tools
                       if mode != "static" else gm.live_tool_count, "tool_schema_chars": s.tool_schema_chars,
                       "models": sorted(agent.models_used), "answer": s.answer}
            except Exception as e:
                row = {"task": t["id"], "mode": mode, "score": 0.0, "error": f"{type(e).__name__}: {str(e)[:300]}",
                       "seconds": round(time.perf_counter() - t0, 1)}
            out.append(row)
            print(f"  [{mode:6}] {t['id']:16} score {row['score']:.2f}  "
                  f"{row.get('input_tokens', 0):>6} in-tok  {row.get('tool_calls', 0):>2} calls  "
                  f"{row.get('failed_calls', 0)} failed  {row.get('seconds')}s  {row.get('error', '')}", flush=True)
            await asyncio.sleep(20)  # let free-tier per-minute token budgets refill between tasks
    finally:
        await gm.close()
    return out


def summarize(rows: list[dict]) -> str:
    def agg(mode: str, key: str, fn=statistics.mean):
        vals = [r[key] for r in rows if r["mode"] == mode and key in r]
        return fn(vals) if vals else 0
    modes = [m for m in ("static", "jit") if any(r["mode"] == m for r in rows)]
    lines = ["| metric | " + " | ".join({"static": "all tools pre-loaded", "jit": "Synaptogenesis (JIT)"}[m] for m in modes) + " |",
             "|---|" + "---|" * len(modes)]
    metrics = [("answer accuracy (facts found)", "score", lambda v: f"{v * 100:.0f}%"),
               ("input tokens / question", "input_tokens", lambda v: f"{v:,.0f}"),
               ("tool-schema size / request (chars)", "tool_schema_chars", lambda v: f"{v:,.0f}"),
               ("tools visible to the model", "peak_tools", lambda v: f"{v:.1f}"),
               ("tool calls / question", "tool_calls", lambda v: f"{v:.1f}"),
               ("failed tool calls / question", "failed_calls", lambda v: f"{v:.2f}"),
               ("model turns / question", "turns", lambda v: f"{v:.1f}"),
               ("seconds / question (incl. free-tier waits)", "seconds", lambda v: f"{v:.1f}")]
    for label, key, fmt in metrics:
        lines.append(f"| {label} | " + " | ".join(fmt(agg(m, key)) for m in modes) + " |")
    lines.append("")
    lines.append("| task | " + " | ".join(f"{m} score" for m in modes) + " |")
    lines.append("|---|" + "---|" * len(modes))
    for tid in dict.fromkeys(r["task"] for r in rows):
        lines.append(f"| {tid} | " + " | ".join(
            next((f"{r['score'] * 100:.0f}%" + (" (error)" if "error" in r else "") for r in rows
                  if r["task"] == tid and r["mode"] == m), "-") for m in modes) + " |")
    return "\n".join(lines)


async def main(n_tasks: int, modes: list[str]) -> None:
    tasks = TASKS[:n_tasks]
    rows: list[dict] = []
    for mode in modes:
        print(f"== mode: {mode}", flush=True)
        rows += await run_mode(mode, tasks)
    out_dir = STATE_DIR / "bench"
    out_dir.mkdir(parents=True, exist_ok=True)
    stamp = time.strftime("%Y%m%d-%H%M%S")
    (out_dir / f"results-{stamp}.json").write_text(json.dumps(rows, indent=1), encoding="utf-8")
    table = summarize(rows)
    models = sorted({m for r in rows for m in r.get("models", [])})
    doc = (f"# Benchmark: every tool pre-loaded vs. just-in-time grafting\n\n"
           f"Run {time.strftime('%Y-%m-%d %H:%M')} · {len(tasks)} questions × {len(modes)} setups · "
           f"models: {', '.join(m.split(':')[-1] for m in models)} (free tiers; models rotate on rate limits)\n\n"
           f"{table}\n\nAccuracy = share of known-true facts (ids, names) present in the answer. "
           f"Raw answers: `.synapto/bench/results-{stamp}.json`.\n")
    (ROOT / "docs").mkdir(exist_ok=True)
    (ROOT / "docs" / "benchmark.md").write_text(doc, encoding="utf-8")
    print("\n" + table)
