"""Neural-map dashboard: the agent, Synapse grafts, the Drift Sentinel and approvals in one page.

    python -m synaptogenesis web [--prewarm] [--port 8700]

Everything runs in this one process; the page receives every event over SSE.
"""
from __future__ import annotations

import asyncio
import itertools
import json
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI, HTTPException
from fastapi.responses import FileResponse, StreamingResponse
from pydantic import BaseModel

from . import events
from .atlas import Atlas
from .config import load_policy, load_systems
from .graft import GraftManager

STATIC = Path(__file__).parent / "dashboard"


class AskIn(BaseModel):
    question: str


class ApproveIn(BaseModel):
    id: int
    approved: bool


class Hub:
    """Fan out events to every connected browser. emit() may run in worker threads."""

    def __init__(self) -> None:
        self.loop: asyncio.AbstractEventLoop | None = None
        self.queues: set[asyncio.Queue] = set()
        self.recent: list[dict] = []

    def push(self, ev: dict) -> None:
        if not self.loop:
            return
        self.loop.call_soon_threadsafe(self._fanout, ev)

    def _fanout(self, ev: dict) -> None:
        self.recent = (self.recent + [ev])[-300:]
        for q in list(self.queues):
            q.put_nowait(ev)


hub = Hub()
_ids = itertools.count(1)
pending: dict[int, asyncio.Future] = {}
state: dict = {"busy": False}


async def web_approver(kind: str, detail: dict) -> bool:
    aid = next(_ids)
    fut: asyncio.Future = asyncio.get_running_loop().create_future()
    pending[aid] = fut
    events.emit("approval.request", id=aid, kind=kind, detail=detail)
    try:
        ok = await asyncio.wait_for(fut, timeout=180)
    except asyncio.TimeoutError:
        ok = False
    pending.pop(aid, None)
    events.emit("approval.resolved", id=aid, approved=ok)
    return ok


def build_app(prewarm: bool = False) -> FastAPI:
    @asynccontextmanager
    async def lifespan(app: FastAPI):
        from .agent import Agent
        from .sentinel import Sentinel
        hub.loop = asyncio.get_running_loop()
        events.subscribe(hub.push)
        systems = load_systems()
        atlas = Atlas.load_or_build(systems)
        gm = GraftManager(systems, atlas, load_policy(), web_approver)

        def on_step(kind: str, data: dict) -> None:
            if kind == "tool_result":
                data = {**data, "output": data.get("output", "")[:400]}
            events.emit("step", step=kind, **data)

        state.update(systems=systems, atlas=atlas, gm=gm, agent=Agent(gm, atlas, on_step=on_step))
        sentinel = asyncio.create_task(Sentinel(systems, atlas, gm).run())
        if prewarm:
            asyncio.create_task(gm.prewarm())
        yield
        sentinel.cancel()
        await gm.close()

    app = FastAPI(title="Synaptogenesis", lifespan=lifespan)

    @app.get("/")
    async def index():
        return FileResponse(STATIC / "index.html")

    @app.get("/api/state")
    async def get_state():
        atlas: Atlas = state["atlas"]
        gm: GraftManager = state["gm"]
        agent = state["agent"]
        return {
            "systems": [{"name": s.name, "mode": s.mode, "description": s.description} for s in state["systems"].values()],
            "capabilities": [{"system": c.system, "tool": c.tool, "spec": c.spec, "mutating": c.mutating,
                              "description": c.description} for c in atlas.caps],
            "grafts": [{"system": g.system, "exposed": list(g.exposed.values()), "server_endpoints": g.server_endpoints}
                       for g in gm.grafts.values()],
            "models": agent.models, "busy": state["busy"],
        }

    @app.get("/api/events")
    async def stream():
        q: asyncio.Queue = asyncio.Queue()
        hub.queues.add(q)

        async def gen():
            try:
                yield "retry: 2000\n\n"
                while True:
                    try:
                        ev = await asyncio.wait_for(q.get(), timeout=15)
                        yield f"data: {json.dumps(ev, default=str)}\n\n"
                    except asyncio.TimeoutError:
                        yield ": keepalive\n\n"
            finally:
                hub.queues.discard(q)

        return StreamingResponse(gen(), media_type="text/event-stream",
                                 headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"})

    @app.post("/api/ask")
    async def ask(body: AskIn):
        if state["busy"]:
            raise HTTPException(409, "The agent is still working on the previous question.")
        q = body.question.strip()
        if not q:
            raise HTTPException(400, "Empty question.")

        async def run() -> None:
            state["busy"] = True
            try:
                s = await state["agent"].ask(q)
                events.emit("answer.text", question=q, text=s.answer, turns=s.turns, tool_calls=s.tool_calls,
                            grafts=s.grafts, peak_live_tools=s.peak_live_tools, seconds=s.seconds,
                            tokens=s.input_tokens + s.output_tokens, models=sorted(state["agent"].models_used))
            except Exception as e:  # surface failures in the UI instead of a silent hang
                events.emit("answer.error", question=q, error=f"{type(e).__name__}: {str(e)[:400]}")
            finally:
                state["busy"] = False

        asyncio.create_task(run())
        return {"accepted": True}

    @app.post("/api/approve")
    async def approve(body: ApproveIn):
        fut = pending.get(body.id)
        if not fut or fut.done():
            raise HTTPException(404, "No such pending approval.")
        fut.set_result(body.approved)
        return {"ok": True}

    @app.post("/api/prewarm")
    async def do_prewarm():
        return await state["gm"].prewarm()

    return app
