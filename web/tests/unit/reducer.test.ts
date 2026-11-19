import { describe, expect, it } from "vitest";
import { initial, key, reduce, type ConsoleState } from "@/lib/useConsole";

const caps = [
  { system: "orders", tool: "list_delayed_shipments", spec: "GET /shipments/delayed", mutating: false, description: "" },
  { system: "tickets", tool: "create_refund", spec: "POST /refunds", mutating: true, description: "" },
];
const base: ConsoleState = reduce(initial, {
  type: "state",
  s: { systems: [{ name: "orders", mode: "hosted", description: "" }], capabilities: caps, grafts: [], models: ["groq:x"], busy: false },
});
const ev = (s: ConsoleState, e: Record<string, unknown>) => reduce(s, { type: "event", e: { ts: 0, ...e } as never });

describe("console reducer", () => {
  it("starts idle with zero live tools once state arrives", () => {
    expect(base.phase).toBe("idle");
    expect(base.live).toEqual([]);
    expect(base.caps).toHaveLength(2);
  });

  it("graft → live tools, prune → dormant, stats count up", () => {
    let s = ev(base, { kind: "ask", question: "q" });
    expect(s.busy).toBe(true);
    s = ev(s, { kind: "graft.start", system: "orders", endpoints: ["GET /shipments/delayed"] });
    expect(s.building).toContain("orders");
    s = ev(s, { kind: "graft.done", system: "orders", endpoints: ["GET /shipments/delayed"], tools: ["list_delayed_shipments"], how: "built", build_ms: 400, connect_ms: 800 });
    expect(s.live).toEqual([key("orders", "GET /shipments/delayed")]);
    expect(s.building).toEqual([]);
    expect(s.stats).toMatchObject({ grafts: 1, builds: 1, peak: 1 });
    s = ev(s, { kind: "tool.call", system: "orders", tool: "list_delayed_shipments", args: {} });
    expect(s.pulses).toHaveLength(1);
    expect(s.stats.calls).toBe(1);
    s = ev(s, { kind: "prune", system: "orders", tools: ["list_delayed_shipments"], live_tools: 0 });
    expect(s.live).toEqual([]);
    expect(s.dormant).toEqual([key("orders", "GET /shipments/delayed")]);
  });

  it("approvals queue up and resolve", () => {
    let s = ev(base, { kind: "approval.request", id: 7, what: "call", detail: { system: "tickets", endpoint: "POST /refunds", args: {} } });
    expect(s.phase).toBe("approval");
    expect(s.approvals[0]).toMatchObject({ id: 7, kind: "call" });
    s = ev(s, { kind: "approval.resolved", id: 7, approved: true });
    expect(s.approvals).toEqual([]);
  });

  it("the Sentinel marks new endpoints fresh and raises a toast", () => {
    const s = ev(base, { kind: "drift", system: "orders", added: ["GET /shipments/{id}/eta"], removed: [], rescan_ms: 3300, smoke: [] });
    expect(s.fresh).toEqual([key("orders", "GET /shipments/{id}/eta")]);
    expect(s.toasts[0].title).toMatch(/New capability/);
  });

  it("answers finish the run", () => {
    const s = ev({ ...base, busy: true }, { kind: "answer.text", text: "done", seconds: 12, turns: 5, tool_calls: 4, grafts: 2, peak_live_tools: 3 });
    expect(s).toMatchObject({ busy: false, phase: "done", answer: "done" });
    expect(s.meta).toContain("peak 3 of 2 tools");
  });

  it("errors are surfaced, not swallowed", () => {
    const s = ev({ ...base, busy: true }, { kind: "answer.error", error: "RateLimitError: x" });
    expect(s).toMatchObject({ busy: false, phase: "error", meta: "RateLimitError: x" });
  });
});
