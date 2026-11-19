"""Synaptogenesis CLI.

  python -m synaptogenesis atlas [--rebuild]       scan every system with Synapse, show the capability atlas
  python -m synaptogenesis search "<intent>"       search the atlas
  python -m synaptogenesis selftest                graft -> call -> prune with no LLM (proves the Synapse loop)
  python -m synaptogenesis ask "<question>"        run the agent once
  python -m synaptogenesis chat                    interactive session
"""
from __future__ import annotations

import argparse
import asyncio
import json
import os
import sys

from .atlas import Atlas
from .config import load_policy, load_systems
from .events import subscribe
from .graft import GraftError, GraftManager

C = {"dim": "\033[2m", "cyan": "\033[36m", "green": "\033[32m", "yellow": "\033[33m", "red": "\033[31m",
     "bold": "\033[1m", "magenta": "\033[35m", "x": "\033[0m"}
if not sys.stdout.isatty() or os.environ.get("NO_COLOR"):
    C = {k: "" for k in C}


def say(color: str, text: str) -> None:
    print(f"{C[color]}{text}{C['x']}", flush=True)


async def console_approver(kind: str, detail: dict) -> bool:
    auto = os.environ.get("SYNAPTO_AUTO_APPROVE")
    if auto is not None:
        ok = auto == "1"
        say("yellow", f"  ⚠ approval ({kind}) auto-{'approved' if ok else 'declined'}: {json.dumps(detail)}")
        return ok
    say("yellow", f"\n  ⚠ APPROVAL NEEDED ({kind}): {json.dumps(detail, indent=2)}")
    ans = await asyncio.to_thread(input, "  approve? [y/N] ")
    return ans.strip().lower() in ("y", "yes")


def on_event(ev: dict) -> None:
    k = ev["kind"]
    if k == "graft.start":
        say("magenta", f"  ⟡ synapse: growing {ev['system']} ← {', '.join(ev['endpoints'])}")
    elif k == "graft.done":
        how = {"built": f"Synapse build {ev['build_ms']}ms + connect {ev['connect_ms']}ms",
               "connected_cached_server": f"cached Synapse server, connect {ev['connect_ms']}ms",
               "reactivated": "dormant connection reactivated, 0ms"}.get(ev.get("how"), "")
        say("magenta", f"  ⟡ grafted {ev['system']}: {len(ev['tools'])} tool(s) · {how} · live tools: {ev['live_tools']}")
    elif k == "prune":
        say("dim", f"  ✂ pruned {ev['system']} · live tools: {ev['live_tools']}")
    elif k == "drift.detected":
        say("yellow", f"  ◎ sentinel: code changed in {ev['system']} → synapse build --discover")
    elif k == "drift":
        if ev["added"] or ev["removed"]:
            say("yellow", f"  ◎ sentinel: {ev['system']} +{len(ev['added'])} / -{len(ev['removed'])} endpoints "
                          f"in {ev['rescan_ms']} ms: " + ", ".join([f'+{a}' for a in ev['added']] + [f'-{r}' for r in ev['removed']]))
        else:
            say("dim", f"  ◎ sentinel: {ev['system']} changed, endpoint surface unchanged ({ev['rescan_ms']} ms)")
        for sm in ev.get("smoke", []):
            say("green" if sm["ok"] else "red", f"    smoke test {sm['endpoint']}: {'OK' if sm['ok'] else 'FAILED'}")
    elif k == "fusion.observed":
        say("dim", f"  ⧉ hebbian: {ev['system']} chain {' > '.join(ev['chain'])} seen {ev['count']}/{ev['threshold']}")
    elif k == "fusion.start":
        say("magenta", f"  ⧉ synapse build --custom: fusing {ev['system']}: {' > '.join(ev['chain'])}")
    elif k == "fusion.built":
        say("magenta", f"  ⧉ Synapse composed '{ev['tool']}' in {ev['build_ms']} ms → verifying in a sandbox")
    elif k == "fusion.verified":
        for c in ev["report"]["checks"]:
            say("green" if c["ok"] else "red", f"    {'✓' if c['ok'] else '✖'} {c['check']}")
    elif k == "fusion.wired":
        say("green", f"  ⧉ new verified tool {ev['system']}.{ev['tool']} replaces {' > '.join(ev['chain'])}")
    elif k == "fusion.failed":
        say("red", f"  ⧉ fusion rejected ({ev.get('stage')}): " + json.dumps(ev.get("report", ev.get("error")))[:400])
    elif k in ("graft.denied", "graft.failed", "graft.declined"):
        say("red", f"  ✖ {k}: {ev}")


def setup():
    from .fusion import load_into
    systems = load_systems()
    atlas = Atlas.load_or_build(systems)
    load_into(systems, atlas)  # verified fused tools from earlier sessions
    gm = GraftManager(systems, atlas, load_policy(), console_approver)
    return systems, atlas, gm


def cmd_atlas(rebuild: bool) -> None:
    systems = load_systems()
    atlas = Atlas.build(systems) if rebuild else Atlas.load_or_build(systems)
    for s in atlas.summary():
        say("bold", f"\n{s['system']}  ({s['endpoints']} endpoints, {s['read_only']} read-only) — {s['description']}")
        for c in [c for c in atlas.caps if c.system == s["system"]]:
            flag = C["yellow"] + " writes" + C["x"] if c.mutating else ""
            print(f"  {c.method:6} {c.path:42} {C['dim']}{c.tool}{C['x']}{flag}")
    print(f"\nTotal: {len(atlas.caps)} endpoints that would be {len(atlas.caps)} always-on tools without grafting.")


async def cmd_selftest() -> None:
    systems, atlas, gm = setup()
    say("bold", f"Atlas: {len(atlas.caps)} endpoints across {len(systems)} systems. Live tools: {gm.live_tool_count}")
    plan = [("inventory", ["GET /stock/low", "GET /products/{sku}/availability"], "get_low_stock", {}),
            ("tickets", ["GET /customers/{customer_id}/tickets"], "list_customer_tickets", {"customer_id": "CUS-101"}),
            ("orders", ["GET /shipments/delayed", "GET /shipments/{shipment_id}/orders"], "list_shipment_orders", {"shipment_id": "SHP-1042"}),
            ("roster", ["GET /oncall/{region}"], "get_oncall", {"region": "west"})]
    try:
        for system, eps, tool, args in plan:
            try:
                res = await gm.graft(system, eps, "selftest")
            except GraftError as e:
                say("red", f"  {system}: {e}")
                continue
            names = list(gm.grafts[system].tools)
            say("green", f"  {system}: tools {names}")
            name = tool if tool in names else names[0]
            out, err = await gm.call(f"{system}__{name}", args)
            say("red" if err else "dim", f"    {name}({args}) -> {out[:300]}")
        say("bold", f"Peak live tools: {gm.peak_tools} (vs {len(atlas.caps)} if everything were pre-wired)")
    finally:
        await gm.close()
        say("bold", f"After prune: {gm.live_tool_count} live tools")


async def cmd_warm(reset: bool = False) -> None:
    systems, atlas, gm = setup()
    for r in await gm.warm(reset=reset):
        say("green", f"  {r['system']}: hosted server ready with {r['endpoints']} read-only endpoints "
                     f"({r['build_ms']} ms Synapse build{' - already warm' if not r['build_ms'] else ''})")
    await gm.close()


def print_step(kind: str, data: dict) -> None:
    if kind == "tool_use":
        say("cyan", f"  → {data['name']}({json.dumps(data['input'])[:200]})")
    elif kind == "tool_result" and data["is_error"]:
        say("red", f"    ✖ {data['output'][:300]}")


async def do_prewarm(gm) -> None:
    say("dim", "  prewarming dormant Synapse connections (no tools exposed)...")
    for r in await gm.prewarm():
        say("red" if "error" in r else "dim", f"    {r['system']}: " + (r.get("error") or f"{r['endpoints']} read-only endpoints ready in {r['ms']} ms"))


async def cmd_ask(question: str, keep: bool = False, prewarm: bool = False) -> None:
    from .agent import Agent
    systems, atlas, gm = setup()
    if prewarm:
        await do_prewarm(gm)
    from .fusion import Fusion
    agent = Agent(gm, atlas, on_step=print_step, auto_prune=not keep, fusion=Fusion(systems, atlas))
    try:
        stats = await agent.ask(question)
        if agent.fusion_tasks:
            say("magenta", "  ⧉ a repeated workflow was detected: Synapse is fusing it (Custom mode) ...")
            await asyncio.gather(*agent.fusion_tasks)
    finally:
        await gm.close()
    say("bold", "\n" + stats.answer)
    say("dim", f"\n[{stats.turns} turns · {stats.tool_calls} tool calls · {stats.grafts} grafts · "
               f"peak {stats.peak_live_tools} live tools of {len(atlas.caps)} · {stats.seconds}s · "
               f"{stats.input_tokens} in / {stats.output_tokens} out tokens · "
               f"{agent.provider}: {', '.join(sorted(agent.models_used)) or agent.models[0]}]")


async def cmd_chat(prewarm: bool = False) -> None:
    from .agent import Agent
    systems, atlas, gm = setup()
    if prewarm:
        await do_prewarm(gm)
    from .sentinel import Sentinel
    from .fusion import Fusion
    agent = Agent(gm, atlas, on_step=print_step, auto_prune=True, fusion=Fusion(systems, atlas))
    sentinel_task = asyncio.create_task(Sentinel(systems, atlas, gm).run())
    say("bold", f"Synaptogenesis — {len(atlas.caps)} endpoints in the atlas, 0 live tools. "
                f"Drift Sentinel watching {len(systems)} systems. Ctrl-C to exit.")
    try:
        while True:
            q = (await asyncio.to_thread(input, "\nyou> ")).strip()
            if not q:
                continue
            stats = await agent.ask(q)
            say("bold", "\n" + stats.answer)
            say("dim", f"[{stats.tool_calls} calls · live tools now {gm.live_tool_count}]")
    except (KeyboardInterrupt, EOFError):
        pass
    finally:
        sentinel_task.cancel()
        await gm.close()


def main() -> None:
    p = argparse.ArgumentParser(prog="synaptogenesis")
    sub = p.add_subparsers(dest="cmd", required=True)
    a = sub.add_parser("atlas"); a.add_argument("--rebuild", action="store_true")
    s = sub.add_parser("search"); s.add_argument("query")
    sub.add_parser("selftest")
    wb = sub.add_parser("web", help="neural-map dashboard (agent + Sentinel + approvals) at http://127.0.0.1:8700")
    wb.add_argument("--port", type=int, default=8700); wb.add_argument("--prewarm", action="store_true")
    bn = sub.add_parser("bench", help="benchmark: every tool pre-loaded vs just-in-time grafting")
    bn.add_argument("--tasks", type=int, default=6); bn.add_argument("--modes", default="static,jit")
    fz = sub.add_parser("fuse", help="manually fuse a chain of tools via Synapse Custom mode (normally automatic)")
    fz.add_argument("system"); fz.add_argument("chain", help="comma-separated tool names, e.g. get_ticket,create_refund")
    fz.add_argument("--args", default="{}", help="JSON inputs to replay during verification")
    sub.add_parser("sentinel", help="watch the systems' code and keep the atlas in sync via synapse --discover")
    w = sub.add_parser("warm", help="pre-build hosted Synapse servers (read-only endpoints) before a demo")
    w.add_argument("--reset", action="store_true", help="drop endpoints added by earlier grafts")
    q = sub.add_parser("ask"); q.add_argument("question"); q.add_argument("--keep", action="store_true")
    q.add_argument("--prewarm", action="store_true", help="pre-connect dormant Synapse servers first")
    c = sub.add_parser("chat"); c.add_argument("--prewarm", action="store_true")
    args = p.parse_args()
    if hasattr(sys.stdout, "reconfigure"):
        sys.stdout.reconfigure(encoding="utf-8")
    subscribe(on_event)
    if args.cmd == "atlas":
        cmd_atlas(args.rebuild)
    elif args.cmd == "search":
        systems = load_systems()
        print(json.dumps(Atlas.load_or_build(systems).search(args.query), indent=1))
    elif args.cmd == "web":
        import uvicorn
        from .web import build_app
        say("bold", f"Synaptogenesis dashboard → http://127.0.0.1:{args.port}")
        uvicorn.run(build_app(prewarm=args.prewarm), host="127.0.0.1", port=args.port, log_level="warning")
    elif args.cmd == "bench":
        from .benchmark import main as bench_main
        asyncio.run(bench_main(args.tasks, [m.strip() for m in args.modes.split(",")]))
    elif args.cmd == "fuse":
        async def run_fuse():
            from .fusion import Fusion
            systems, atlas, gm = setup()
            chain = [{"tool": t.strip(), "input": json.loads(args.args)} for t in args.chain.split(",")]
            res = await Fusion(systems, atlas).fuse(args.system, chain)
            say("bold", json.dumps({k: v for k, v in res.items() if k != "report"}))
            await gm.close()
        asyncio.run(run_fuse())
    elif args.cmd == "sentinel":
        async def run_sentinel():
            from .sentinel import Sentinel
            systems, atlas, gm = setup()
            say("bold", f"Drift Sentinel watching {', '.join(systems)} (Ctrl-C to stop)")
            try:
                await Sentinel(systems, atlas, gm).run()
            finally:
                await gm.close()
        try:
            asyncio.run(run_sentinel())
        except KeyboardInterrupt:
            pass
    elif args.cmd == "warm":
        asyncio.run(cmd_warm(args.reset))
    elif args.cmd == "selftest":
        asyncio.run(cmd_selftest())
    elif args.cmd == "ask":
        asyncio.run(cmd_ask(args.question, args.keep, args.prewarm))
    elif args.cmd == "chat":
        asyncio.run(cmd_chat(args.prewarm))


if __name__ == "__main__":
    main()
