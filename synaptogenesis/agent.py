"""The agent: starts with zero business tools and grows them via Synapse as it works.

Manual Messages-API loop (not the tool runner) because the tool list changes
between turns as grafts are added and pruned.
"""
from __future__ import annotations

import asyncio
import json
import os
import time
from dataclasses import dataclass, field

import anthropic

from .atlas import Atlas
from .events import emit
from .graft import GraftError, GraftManager

EFFORT = os.environ.get("SYNAPTO_EFFORT", "medium")
MAX_TURNS = int(os.environ.get("SYNAPTO_MAX_TURNS", "14"))
PREFER_WAIT_S = float(os.environ.get("SYNAPTO_PREFER_WAIT_S", "6"))

# OpenAI-compatible free providers: (base_url, key env var, default model)
OPENAI_COMPAT = {
    "groq": ("https://api.groq.com/openai/v1", "GROQ_API_KEY", "openai/gpt-oss-120b"),
    "gemini": ("https://generativelanguage.googleapis.com/v1beta/openai/", "GEMINI_API_KEY", "gemini-2.5-flash"),
    "openrouter": ("https://openrouter.ai/api/v1", "OPENROUTER_API_KEY", "nvidia/nemotron-3-ultra-550b-a55b:free"),
}


# Free tiers cap tokens-per-minute PER MODEL, so every (provider, model) pair is a separate budget.
# Order = preference: strongest tool-callers with the biggest free budgets first.
FREE_MODELS = {
    "gemini": ["gemini-2.5-flash", "gemini-2.5-flash-lite"],
    "groq": ["openai/gpt-oss-120b", "qwen/qwen3.8-27b", "openai/gpt-oss-20b"],
    # Free + tool-calling on OpenRouter as of 2026-11-19 (list changes often: check /api/v1/models).
    "openrouter": ["nvidia/nemotron-3-ultra-550b-a55b:free", "google/gemma-4-31b-it:free"],
}


def build_routes() -> list[tuple[str, str]]:
    """[(provider, model), ...] for every provider whose key is set. SYNAPTO_PROVIDER pins one provider;
    SYNAPTO_<PROVIDER>_MODELS (comma list) overrides its models; SYNAPTO_MODEL pins a single model."""
    pin = os.environ.get("SYNAPTO_PROVIDER")
    if pin == "anthropic" or (not pin and not any(os.environ.get(OPENAI_COMPAT[p][1]) for p in OPENAI_COMPAT)):
        return [("anthropic", os.environ.get("SYNAPTO_MODEL") or "claude-opus-5-5")]
    routes = []
    for name in FREE_MODELS:
        if (pin and name != pin) or not os.environ.get(OPENAI_COMPAT[name][1]):
            continue
        override = os.environ.get(f"SYNAPTO_{name.upper()}_MODELS")
        models = [m.strip() for m in override.split(",")] if override else FREE_MODELS[name]
        routes += [(name, m) for m in models if m]
    if os.environ.get("SYNAPTO_MODEL"):
        routes = [r for r in routes if r[1] == os.environ["SYNAPTO_MODEL"]] or routes
    return routes


ROUTES = build_routes()
PROVIDER = ROUTES[0][0]
MODEL = ROUTES[0][1]
TOOL_RESULT_LIMIT = 20000 if PROVIDER == "anthropic" else 6000  # free tiers have small tokens-per-minute budgets


def _clean_schema(schema: dict) -> dict:
    """Make MCP input schemas acceptable to strict OpenAI-compatible validators."""
    s = {k: v for k, v in (schema or {}).items() if k not in ("$schema", "title")}
    s.setdefault("type", "object")
    props = {}
    for name, p in (s.get("properties") or {}).items():
        p = {k: v for k, v in p.items() if k not in ("title", "default")}
        if "type" not in p and "anyOf" not in p and "$ref" not in p:
            p["type"] = "string"  # Synapse local passthrough types params as Any
        props[name] = p
    s["properties"] = props
    return s

SYSTEM_PROMPT = """You are the operations copilot for Meridian Medical Supply, a distributor of insulin and diabetes supplies.

You start with NO access to company systems. You grow access on demand, through Synapse:
- find_capability: search the capability atlas (every endpoint of every internal system). Pass ALL your information needs as a list of queries in ONE call.
- graft: Synapse builds live connections to ONLY the endpoints you need. Pass grafts for ALL systems you need in ONE call. New tools appear on your next step, named <system>__<tool>.
- Then call the grafted tools. Call independent tools IN PARALLEL in the same step (e.g. one tickets lookup per customer at once).
- Connections are pruned automatically when you finish; you do not need to call prune.

Be efficient. The ideal path is: 1 find_capability call -> 1 graft call -> 1-2 steps of parallel tool calls -> answer.

Rules:
- If find_capability returns a [VERIFIED ONE-STEP WORKFLOW] tool (system ending in _fused) that does the whole job, graft and use it instead of chaining individual steps.
- Least privilege: graft the smallest set of endpoints that answers the question. Prefer read-only endpoints and endpoints that filter by id over list-everything endpoints.
- Never guess data. Every fact in your answer must come from a tool result.
- When the user asks you to DO something (refund, page someone, create an order...), graft the data-changing endpoint and CALL it. The harness pauses and asks a human to approve before it runs, so never ask for approval in text. If the human declines, accept it and say what you would have done.
- Questions often span systems (orders + tickets + roster + inventory). Join facts by shared ids: customers CUS-*, orders ORD-*, shipments SHP-*, staff EMP-*, warehouses WH-*. Pune is in the "west" region.
- Final answer: decision-ready and SHORT (under 180 words; compact bullets, no long tables). After each fact, cite its source as [system.tool]. End with a one-line "Next step"."""

STATIC_PROMPT = """You are the operations copilot for Meridian Medical Supply, a distributor of insulin and diabetes supplies.
You have tools for every internal system (orders, inventory, tickets, roster), named <system>__<tool>.
Call independent tools in parallel. Never guess data; every fact must come from a tool result.
Join facts by shared ids: customers CUS-*, orders ORD-*, shipments SHP-*, staff EMP-*, warehouses WH-*. Pune is in the "west" region.
Final answer: decision-ready and SHORT (under 180 words). After each fact, cite its source as [system.tool]."""

META_TOOLS = [
    {"name": "find_capability",
     "description": "Search every internal system's endpoints by intent. Pass all your needs at once, e.g. ['delayed shipments', 'tickets for a customer', 'who is on call']. Returns, per query, the system, exact endpoint, tool name, params and whether it changes data.",
     "input_schema": {"type": "object", "properties": {
         "queries": {"type": "array", "items": {"type": "string"}, "description": "One plain-words query per information need."},
         "limit": {"type": "integer", "description": "Max results per query, default 4."}},
         "required": ["queries"]}},
    {"name": "graft",
     "description": "Have Synapse build live MCP connections to specific endpoints. One entry per system; pass every system you need in ONE call. Endpoints must be exact 'METHOD /path' strings from find_capability. Tools appear on your next step.",
     "input_schema": {"type": "object", "properties": {
         "grafts": {"type": "array", "items": {"type": "object", "properties": {
             "system": {"type": "string"},
             "endpoints": {"type": "array", "items": {"type": "string"}},
             "reason": {"type": "string", "description": "One line: why this access is needed."}},
             "required": ["system", "endpoints", "reason"]}}},
         "required": ["grafts"]}},
    {"name": "list_systems",
     "description": "List the company's systems with a description and endpoint counts.",
     "input_schema": {"type": "object", "properties": {}}},
]


@dataclass
class RunStats:
    question: str
    turns: int = 0
    tool_calls: int = 0
    grafts: int = 0
    peak_live_tools: int = 0
    input_tokens: int = 0
    output_tokens: int = 0
    seconds: float = 0.0
    answer: str = ""
    stop_reason: str = ""
    tool_schema_chars: int = 0
    failed_calls: int = 0
    trace: list[dict] = field(default_factory=list)


class Agent:
    def __init__(self, grafts: GraftManager, atlas: Atlas, on_step=None, auto_prune: bool = True, fusion=None,
                 static: bool = False):
        self.static = static  # benchmark baseline: every tool pre-loaded, no atlas/graft meta-tools
        self.grafts = grafts
        self.fusion = fusion
        self.fusion_tasks: list[asyncio.Task] = []
        self.atlas = atlas
        self.provider = PROVIDER
        self.routes = ROUTES
        self.models = [f"{p}:{m}" for p, m in ROUTES]
        self.clients: dict[str, object] = {}
        if PROVIDER in OPENAI_COMPAT:
            from openai import AsyncOpenAI
            for p in dict.fromkeys(p for p, _ in ROUTES):
                base_url, key_env, _ = OPENAI_COMPAT[p]
                self.clients[p] = AsyncOpenAI(base_url=base_url, api_key=os.environ[key_env], max_retries=0, timeout=60)
        else:
            self.client = anthropic.AsyncAnthropic()
        self._cooldown: dict[str, float] = {}
        self.models_used: set[str] = set()
        self.on_step = on_step or (lambda kind, data: None)
        self.auto_prune = auto_prune

    async def _run_tool(self, name: str, args: dict, stats: RunStats) -> tuple[str, bool]:
        stats.tool_calls += 1
        self.on_step("tool_use", {"name": name, "input": args})
        if self.grafts.owns(name):
            out, is_err = await self.grafts.call(name, args)
        else:
            out, is_err = await self._meta(name, args, stats)
        if len(out) > TOOL_RESULT_LIMIT:
            out = out[:TOOL_RESULT_LIMIT] + "\n…(truncated)"
        self.on_step("tool_result", {"name": name, "is_error": is_err, "output": out})
        stats.trace.append({"tool": name, "input": args, "is_error": is_err})
        stats.failed_calls += int(is_err)
        return out, is_err

    async def _chat_with_rotation(self, **kwargs):
        """Free tiers limit tokens-per-minute PER MODEL. On a 429, switch to the next model
        immediately instead of sleeping; sleep only if every model is cooling down."""
        from openai import APIConnectionError, APIStatusError, InternalServerError, RateLimitError
        failures = 0
        while True:
            now = time.time()
            ready = [m for m in self.models if self._cooldown.get(m, 0) <= now]
            if not ready:
                wait = min(self._cooldown.values()) - now
                emit("llm.waiting", seconds=round(wait, 1))
                await asyncio.sleep(max(wait, 0.5))
                continue
            model = ready[0]
            # Prefer a faster, higher-priority model that is about to come off cooldown over a
            # slower fallback (e.g. free OpenRouter, which is also capped at 50 requests/day).
            better = [m for m in self.models[:self.models.index(model)] if self._cooldown.get(m, 0) - now <= PREFER_WAIT_S]
            if better:
                wait = self._cooldown[better[0]] - now
                emit("llm.waiting", seconds=round(wait, 1), for_model=better[0])
                await asyncio.sleep(max(wait, 0.2))
                continue
            provider, _, model_id = model.partition(":")
            self._last_model = model
            try:
                resp = await self.clients[provider].chat.completions.create(model=model_id, **kwargs)
                self.models_used.add(model)
                return resp
            except RateLimitError as e:
                retry = e.response.headers.get("retry-after") if e.response is not None else None
                try:
                    delay = float(retry) if retry else 10.0
                except ValueError:
                    delay = 10.0
                self._cooldown[model] = time.time() + delay
                emit("llm.rate_limited", model=model, retry_after=delay)
            except (APIConnectionError, InternalServerError) as e:  # includes timeouts; before APIStatusError (subclass)
                failures += 1
                emit("llm.transient_error", model=model, error=type(e).__name__)
                if failures >= 6:
                    raise
                self._cooldown[model] = time.time() + 3
            except APIStatusError as e:
                if e.status_code != 413:  # 413: request bigger than this model's per-request limit
                    raise
                self._cooldown[model] = time.time() + 300
                emit("llm.too_large", model=model)

    async def _loop_openai(self, question: str, history: list, stats: RunStats) -> None:
        """Chat-completions tool loop for OpenAI-compatible providers (Groq, Gemini, OpenRouter)."""
        from openai import BadRequestError
        messages = [{"role": "system", "content": STATIC_PROMPT if self.static else SYSTEM_PROMPT}] + list(history) +                    [{"role": "user", "content": question}]
        rejected = 0
        while stats.turns < MAX_TURNS:
            stats.turns += 1
            tools = [{"type": "function", "function": {"name": t["name"], "description": t["description"][:1000],
                                                       "parameters": _clean_schema(t["input_schema"])}}
                     for t in ([] if self.static else META_TOOLS) + self.grafts.anthropic_tools()]
            stats.tool_schema_chars = max(stats.tool_schema_chars, len(json.dumps(tools)))
            try:
                resp = await self._chat_with_rotation(messages=messages, tools=tools, tool_choice="auto", temperature=0.2)
            except BadRequestError as e:
                # Providers validate tool calls server-side (e.g. Groq "tool_use_failed" for a misspelled
                # tool name). Tell the model what went wrong and let it try again instead of crashing.
                text = str(e)
                retryable = ("tool_use_failed", "tool call validation", "Failed to call a function",
                             "Parsing failed", "failed_generation", "could not be parsed")
                if rejected >= 4 or not any(s in text for s in retryable):
                    raise
                rejected += 1
                if self.models_used:  # let rotation try a different model for the retry
                    last = getattr(self, "_last_model", None)
                    if last:
                        self._cooldown[last] = time.time() + 2
                names = ", ".join(t["function"]["name"] for t in tools)
                emit("llm.tool_call_rejected", error=text[:300])
                messages.append({"role": "user", "content": f"(harness) Your last tool call was rejected: {text[:300]}. "
                                                            f"Tools available right now: {names}. Use an exact name."})
                continue
            if resp.usage:
                stats.input_tokens += resp.usage.prompt_tokens or 0
                stats.output_tokens += resp.usage.completion_tokens or 0
            msg = resp.choices[0].message
            stats.stop_reason = resp.choices[0].finish_reason or ""
            calls = msg.tool_calls or []
            entry = {"role": "assistant", "content": msg.content or ""}
            if calls:
                entry["tool_calls"] = [{"id": c.id, "type": "function",
                                        "function": {"name": c.function.name, "arguments": c.function.arguments or "{}"}}
                                       for c in calls]
            messages.append(entry)
            if msg.content and msg.content.strip():
                self.on_step("text", {"text": msg.content})
            if not calls:
                stats.answer = msg.content or ""
                return
            async def run_call(c):
                try:
                    args = json.loads(c.function.arguments or "{}")
                    if not isinstance(args, dict):
                        raise ValueError("arguments must be a JSON object")
                except ValueError as e:
                    return f"Invalid JSON arguments ({e}). Call the tool again with a valid JSON object.", True
                return await self._run_tool(c.function.name, args, stats)
            results = await asyncio.gather(*(run_call(c) for c in calls))  # independent calls run concurrently
            for c, (out, is_err) in zip(calls, results):
                messages.append({"role": "tool", "tool_call_id": c.id,
                                 "content": ("ERROR: " if is_err else "") + out})
        stats.answer = stats.answer or "(stopped: turn limit reached)"

    async def _meta(self, name: str, args: dict, stats: RunStats) -> tuple[str, bool]:
        if name == "find_capability":
            queries = args.get("queries") or ([args["query"]] if args.get("query") else [])
            if isinstance(queries, str):
                queries = [queries]
            limit = int(args.get("limit") or 4)
            out = {}
            for q in queries[:8]:
                hits = self.atlas.search(q, limit)
                emit("atlas.search", query=q, hits=len(hits))
                out[q] = [{k: h[k] for k in ("system", "endpoint", "tool", "params", "changes_data")} | {"about": h["description"][:90]}
                          for h in hits] or "no match - try other words"
            return json.dumps(out, separators=(",", ":")), False
        if name == "list_systems":
            return json.dumps(self.atlas.summary(), separators=(",", ":")), False
        if name == "graft":
            reqs = args.get("grafts")
            if reqs is None and args.get("system"):  # tolerate the single-system shape
                reqs = [{"system": args["system"], "endpoints": args.get("endpoints") or [], "reason": args.get("reason", "")}]
            if not isinstance(reqs, list) or not reqs:
                return "Pass grafts: [{system, endpoints, reason}, ...]", True
            results = await self.grafts.graft_many(reqs)
            stats.grafts += sum("error" not in r for r in results)
            stats.peak_live_tools = max(stats.peak_live_tools, self.grafts.live_tool_count)
            return json.dumps(results, separators=(",", ":")), all("error" in r for r in results)
        if name == "prune":
            pruned = await self.grafts.prune(args.get("system"))
            return json.dumps({"pruned": pruned, "live_tools_total": self.grafts.live_tool_count}), False
        return f"Unknown tool {name}", True

    async def ask(self, question: str, history: list | None = None) -> RunStats:
        stats = RunStats(question=question)
        t0 = time.perf_counter()
        emit("ask", question=question, provider=self.provider, model=MODEL)
        if self.provider in OPENAI_COMPAT:
            try:
                await self._loop_openai(question, history or [], stats)
            finally:
                await self._finish(stats, t0)
            return stats
        messages = list(history or []) + [{"role": "user", "content": question}]
        while stats.turns < MAX_TURNS:
            stats.turns += 1
            tools = META_TOOLS + self.grafts.anthropic_tools()
            response = await self.client.beta.messages.create(
                model=MODEL,
                max_tokens=16000,
                system=SYSTEM_PROMPT,
                tools=tools,
                messages=messages,
                output_config={"effort": EFFORT},
                betas=["server-side-fallback-2026-07-01"],
                fallbacks="default",
            )
            stats.input_tokens += response.usage.input_tokens
            stats.output_tokens += response.usage.output_tokens
            stats.stop_reason = response.stop_reason or ""
            messages.append({"role": "assistant", "content": response.content})

            for b in response.content:
                if b.type == "text" and b.text.strip():
                    self.on_step("text", {"text": b.text})

            if response.stop_reason == "pause_turn":
                continue
            if response.stop_reason != "tool_use":
                break

            blocks = [b for b in response.content if b.type == "tool_use"]
            outs = await asyncio.gather(*(self._run_tool(b.name, b.input if isinstance(b.input, dict) else {}, stats)
                                          for b in blocks))
            messages.append({"role": "user", "content": [
                {"type": "tool_result", "tool_use_id": b.id, "content": out, "is_error": is_err}
                for b, (out, is_err) in zip(blocks, outs)]})

        stats.answer = "\n".join(b.text for b in messages[-1]["content"] if getattr(b, "type", "") == "text") \
            if messages[-1]["role"] == "assistant" else ""
        if stats.stop_reason == "refusal":
            stats.answer = stats.answer or "(The model declined this request.)"
        await self._finish(stats, t0)
        return stats

    async def _finish(self, stats: RunStats, t0: float) -> None:
        if self.fusion:  # Hebbian learning: repeated multi-step workflows get fused by Synapse
            for r in self.fusion.observe(stats.trace):
                self.fusion_tasks.append(asyncio.create_task(self.fusion.fuse(r["system"], r["chain"])))
        stats.peak_live_tools = max(stats.peak_live_tools, self.grafts.peak_tools)
        if self.auto_prune:
            await self.grafts.prune()
        stats.seconds = round(time.perf_counter() - t0, 1)
        emit("answer", question=stats.question, provider=self.provider, model=MODEL, turns=stats.turns, tool_calls=stats.tool_calls, grafts=stats.grafts,
             peak_live_tools=stats.peak_live_tools, seconds=stats.seconds,
             input_tokens=stats.input_tokens, output_tokens=stats.output_tokens)
