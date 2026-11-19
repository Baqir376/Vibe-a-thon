"use client";

import { useEffect, useRef, useState } from "react";

export const API = process.env.NEXT_PUBLIC_SYNAPTO_API ?? "http://127.0.0.1:8700";

export type System = { name: string; mode: "local" | "hosted" | "fused"; description: string };
export type Capability = { system: string; tool: string; spec: string; mutating: boolean; description: string };
export type GraftInfo = { system: string; exposed: string[]; server_endpoints: string[] };
export type AgentState = { systems: System[]; capabilities: Capability[]; grafts: GraftInfo[]; models: string[]; busy: boolean };
// Every event the Python side emits has a `kind` plus event-specific fields.
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- payload shape varies by event kind (see synaptogenesis/events.py)
export type AgentEvent = { kind: string; ts: number; [k: string]: any };

export async function getState(): Promise<AgentState | null> {
  try {
    const r = await fetch(`${API}/api/state`, { cache: "no-store" });
    return r.ok ? await r.json() : null;
  } catch {
    return null;
  }
}

export async function ask(question: string): Promise<string | null> {
  try {
    const r = await fetch(`${API}/api/ask`, {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ question }),
    });
    if (r.ok) return null;
    const d = await r.json().catch(() => ({}));
    return typeof d.detail === "string" ? d.detail : JSON.stringify(d.detail ?? r.statusText);
  } catch {
    return `Agent server not reachable at ${API}. Start it with: python -m synaptogenesis web`;
  }
}

export async function approve(id: number, approved: boolean) {
  await fetch(`${API}/api/approve`, {
    method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id, approved }),
  }).catch(() => {});
}

export async function prewarm() {
  await fetch(`${API}/api/prewarm`, { method: "POST" }).catch(() => {});
}

/** Subscribe to the agent's live event stream (Server-Sent Events). */
export function useAgentEvents(onEvent: (e: AgentEvent) => void) {
  const handler = useRef(onEvent);
  useEffect(() => { handler.current = onEvent; });
  const [connected, setConnected] = useState(false);
  useEffect(() => {
    const es = new EventSource(`${API}/api/events`);
    es.onopen = () => setConnected(true);
    es.onerror = () => setConnected(false);
    es.onmessage = (m) => {
      try { handler.current(JSON.parse(m.data)); } catch { /* ignore malformed */ }
    };
    return () => es.close();
  }, []);
  return connected;
}
