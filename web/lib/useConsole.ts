"use client";

import { useCallback, useEffect, useReducer } from "react";
import { getState, useAgentEvents, type AgentEvent, type AgentState, type Capability, type System } from "./api";

export type Phase = "offline" | "idle" | "thinking" | "searching" | "building" | "calling" | "approval" | "pruning" | "fusing" | "sentinel" | "done" | "error";
export type Tone = "violet" | "live" | "read" | "write" | "drift" | "danger" | "muted";
export type Line = { id: number; tone: Tone; icon: string; text: string; detail?: string };
export type Toast = { id: number; tone: Tone; title: string; body: string };
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- approval detail differs for graft vs call
export type Approval = { id: number; kind: string; detail: any };
export type Pulse = { id: number; key: string };

export type ConsoleState = {
  systems: System[];
  caps: Capability[];
  live: string[];        // "system|spec"
  dormant: string[];
  fresh: string[];       // discovered by the Sentinel, highlighted until used
  building: string[];    // systems Synapse is building right now
  phase: Phase;
  status: string;
  lines: Line[];
  pulses: Pulse[];
  toasts: Toast[];
  approvals: Approval[];
  question: string;
  answer: string;
  meta: string;
  busy: boolean;
  stats: { builds: number; grafts: number; calls: number; peak: number };
  models: string[];
};

export const key = (system: string, spec: string) => `${system}|${spec}`;

type Action =
  | { type: "state"; s: AgentState }
  | { type: "event"; e: AgentEvent }
  | { type: "dismissToast"; id: number }
  | { type: "dropPulse"; id: number }
  | { type: "offline" }
  | { type: "local"; question: string };

let uid = 1;
const initial: ConsoleState = {
  systems: [], caps: [], live: [], dormant: [], fresh: [], building: [], phase: "offline",
  status: "Connecting to the agent…", lines: [], pulses: [], toasts: [], approvals: [], question: "", answer: "",
  meta: "", busy: false, stats: { builds: 0, grafts: 0, calls: 0, peak: 0 }, models: [],
};

function push(s: ConsoleState, tone: Tone, icon: string, text: string, detail?: string): Line[] {
  return [{ id: uid++, tone, icon, text, detail }, ...s.lines].slice(0, 120);
}
function toast(s: ConsoleState, tone: Tone, title: string, body: string): Toast[] {
  return [...s.toasts, { id: uid++, tone, title, body }].slice(-4);
}
const without = (arr: string[], drop: string[]) => arr.filter((x) => !drop.includes(x));
const uniq = (arr: string[]) => Array.from(new Set(arr));

function reduce(s: ConsoleState, a: Action): ConsoleState {
  if (a.type === "offline") return { ...s, phase: "offline", status: "Agent server offline: run  python -m synaptogenesis web" };
  if (a.type === "dismissToast") return { ...s, toasts: s.toasts.filter((t) => t.id !== a.id) };
  if (a.type === "dropPulse") return { ...s, pulses: s.pulses.filter((p) => p.id !== a.id) };
  if (a.type === "local") return { ...s, question: a.question, answer: "", meta: "", busy: true, phase: "thinking", status: "Thinking…" };
  if (a.type === "state") {
    const live = a.s.grafts.flatMap((g) => g.exposed.map((sp) => key(g.system, sp)));
    return { ...s, systems: a.s.systems, caps: a.s.capabilities, live: uniq([...s.live, ...live]).filter((k) => a.s.capabilities.some((c) => key(c.system, c.spec) === k)),
             models: a.s.models, busy: a.s.busy || s.busy, phase: s.phase === "offline" ? (a.s.busy ? "thinking" : "idle") : s.phase,
             status: s.phase === "offline" ? "Ready · 0 tools live" : s.status };
  }
  const e = a.e;
  switch (e.kind) {
    case "ask":
      return { ...s, question: e.question, answer: "", meta: "", busy: true, phase: "thinking", status: "Thinking…",
               lines: push(s, "violet", "?", e.question) };
    case "atlas.search":
      return { ...s, phase: "searching", status: `Searching the atlas: “${e.query}”`, lines: push(s, "muted", "⌕", `find_capability “${e.query}”`, `${e.hits} matches`) };
    case "graft.start":
      return { ...s, phase: "building", building: uniq([...s.building, e.system]), status: `Synapse is growing ${e.system}…`,
               lines: push(s, "violet", "⟡", `graft ${e.system}`, (e.endpoints as string[]).join(" · ")) };
    case "graft.done": {
      const keys = (e.endpoints as string[]).map((sp) => key(e.system, sp));
      const live = uniq([...s.live, ...keys]);
      const how = e.how === "built" ? `Synapse build ${(e.build_ms / 1000).toFixed(1)} s` : e.how === "reactivated" ? "dormant connection reactivated" : `cached server, connect ${(e.connect_ms / 1000).toFixed(1)} s`;
      return { ...s, live, dormant: without(s.dormant, keys), building: s.building.filter((x) => x !== e.system),
               fresh: without(s.fresh, keys), phase: "calling", status: `${live.length} live tool${live.length === 1 ? "" : "s"} · ${e.system} grafted`,
               stats: { ...s.stats, grafts: s.stats.grafts + 1, builds: s.stats.builds + (e.how === "built" ? 1 : 0), peak: Math.max(s.stats.peak, live.length) },
               lines: push(s, "live", "✓", `${e.system}: ${e.tools.length} tool${e.tools.length === 1 ? "" : "s"}`, how) };
    }
    case "tool.call": {
      const cap = s.caps.find((c) => c.system === e.system && c.tool === e.tool);
      return { ...s, phase: "calling", status: `Calling ${e.system}.${e.tool}`,
               pulses: cap ? [...s.pulses, { id: uid++, key: key(cap.system, cap.spec) }] : s.pulses,
               stats: { ...s.stats, calls: s.stats.calls + 1 },
               lines: push(s, "read", "→", `${e.system}.${e.tool}`, JSON.stringify(e.args ?? {})) };
    }
    case "tool.result":
      return e.ok ? s : { ...s, lines: push(s, "danger", "✖", `${e.system}.${e.tool} failed`) };
    case "prune": {
      const gone = s.live.filter((k) => k.startsWith(e.system + "|"));
      const live = without(s.live, gone);
      return { ...s, live, dormant: uniq([...s.dormant, ...gone]), phase: "pruning", status: `Pruned ${e.system} · ${live.length} tools live`,
               lines: push(s, "muted", "✂", `prune ${e.system}`, "dormant · instant to reactivate") };
    }
    case "approval.request":
      return { ...s, phase: "approval", status: "Waiting for a human", approvals: [...s.approvals, { id: e.id, kind: e.kind, detail: e.detail }],
               lines: push(s, "write", "⚠", `approval needed: ${e.kind}`, e.detail?.endpoint ?? (e.detail?.endpoints ?? []).join(", ")) };
    case "approval.resolved":
      return { ...s, approvals: s.approvals.filter((x) => x.id !== e.id), lines: push(s, e.approved ? "live" : "danger", e.approved ? "✓" : "✋", e.approved ? "approved by human" : "declined by human") };
    case "graft.denied":
      return { ...s, lines: push(s, "danger", "⛔", `policy blocked ${e.system}`, e.endpoint), toasts: toast(s, "danger", "Policy blocked a graft", `${e.system} · ${e.endpoint}`) };
    case "drift.detected":
      return { ...s, phase: "sentinel", status: `Sentinel: code changed in ${e.system}`, lines: push(s, "drift", "◎", `code changed in ${e.system}`, "synapse build --discover") };
    case "drift":
      if (!(e.added.length || e.removed.length)) return { ...s, lines: push(s, "muted", "◎", `${e.system}: surface unchanged`) };
      return { ...s, fresh: uniq([...s.fresh, ...(e.added as string[]).map((sp) => key(e.system, sp))]),
               phase: s.busy ? s.phase : "idle", status: s.busy ? s.status : "Ready",
               lines: push(s, "drift", "◎", `${e.system}: +${e.added.length} / −${e.removed.length} endpoints`, [...e.added.map((x: string) => "+" + x), ...e.removed.map((x: string) => "−" + x)].join("  ")),
               toasts: toast(s, "drift", "New capability discovered", `${e.added.join(", ") || e.removed.map((x: string) => "removed " + x).join(", ")} · ${(e.rescan_ms / 1000).toFixed(1)} s`) };
    case "fusion.observed":
      return { ...s, lines: push(s, "violet", "⧉", `learning ${e.system}: ${e.chain.join(" › ")}`, `seen ${e.count}/${e.threshold}`) };
    case "fusion.start":
      return { ...s, phase: "fusing", status: `Synapse is fusing ${e.chain.join(" › ")}`, building: uniq([...s.building, e.system]),
               lines: push(s, "violet", "⧉", "synapse build --custom", e.chain.join(" › ")) };
    case "fusion.built":
      return { ...s, lines: push(s, "violet", "⧉", `composed ${e.tool}`, `${e.build_ms} ms · verifying in a sandbox`) };
    case "fusion.verified":
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- verification report from fusion.py
      return { ...s, lines: (e.report.checks as any[]).reduce((acc: Line[], c) => [{ id: uid++, tone: c.ok ? "live" : "danger", icon: c.ok ? "✓" : "✖", text: c.check }, ...acc], s.lines) };
    case "fusion.failed":
      return { ...s, building: s.building.filter((x) => x !== e.system), lines: push(s, "danger", "⧉", `fusion rejected (${e.stage})`),
               toasts: toast(s, "danger", "Fusion rejected", `The composed tool failed verification at ${e.stage}`) };
    case "fusion.wired":
      return { ...s, building: [], phase: s.busy ? s.phase : "idle", status: s.busy ? s.status : "Ready",
               lines: push(s, "live", "⧉", `new verified tool ${e.system}.${e.tool}`, `replaces ${e.chain.join(" › ")}`),
               toasts: toast(s, "violet", "A new neuron was born", `${e.tool} replaces ${e.chain.join(" › ")}`) };
    case "answer.text":
      return { ...s, busy: false, phase: "done", answer: e.text, status: `Answered in ${e.seconds} s · tools back to ${s.live.length}`,
               meta: `${e.turns} turns · ${e.tool_calls} calls · ${e.grafts} grafts · peak ${e.peak_live_tools} of ${s.caps.length} tools · ${e.seconds} s`,
               lines: push(s, "live", "✔", `answered in ${e.seconds} s`) };
    case "answer.error":
      return { ...s, busy: false, phase: "error", status: "Something went wrong", answer: "", meta: e.error, lines: push(s, "danger", "✖", e.error) };
    default:
      return s;
  }
}

export function useConsole() {
  const [s, dispatch] = useReducer(reduce, initial);
  const refresh = useCallback(async () => {
    const st = await getState();
    dispatch(st ? { type: "state", s: st } : { type: "offline" });
  }, []);
  const connected = useAgentEvents((e) => {
    dispatch({ type: "event", e });
    if (e.kind === "drift" || e.kind === "fusion.wired") refresh();
  });
  useEffect(() => { refresh(); }, [refresh, connected]);
  return {
    s, connected,
    local: (question: string) => dispatch({ type: "local", question }),
    dismissToast: (id: number) => dispatch({ type: "dismissToast", id }),
    dropPulse: (id: number) => dispatch({ type: "dropPulse", id }),
  };
}
