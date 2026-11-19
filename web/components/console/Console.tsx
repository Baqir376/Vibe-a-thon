"use client";

import Link from "next/link";
import { motion } from "motion/react";
import { useCallback, useState } from "react";
import { LogoMark, Wordmark } from "@/components/Logo";
import { ask, prewarm } from "@/lib/api";
import { useConsole } from "@/lib/useConsole";
import { NeuralMap } from "./NeuralMap";
import { AnswerCard, ApprovalSheet, LiveCounter, Stats, StatusIsland, Timeline, Toasts } from "./Panels";

const EXAMPLES = [
  "The insulin shipment to Pune is delayed. Which customers are affected, have they raised support tickets, and who is on call to handle it?",
  "Is there a revised ETA for shipment SHP-1042?",
  "Which insulin products are low in the Pune warehouse, and where else can we get them?",
  "Process a refund for ticket TKT-9002 (order ORD-5003, value 35390 INR): 4 days late.",
  "Who manages Sahyadri Diabetes Clinic's account?",
];

export function Console() {
  const { s, connected, local, dismissToast, dropPulse } = useConsole();
  const [q, setQ] = useState(EXAMPLES[0]);
  const [err, setErr] = useState<string | null>(null);
  const [warming, setWarming] = useState(false);
  const onPulseDone = useCallback((id: number) => dropPulse(id), [dropPulse]);

  const submit = async () => {
    const question = q.trim();
    if (!question || s.busy) return;
    setErr(null);
    local(question);
    const e = await ask(question);
    if (e) setErr(e);
  };

  return (
    <div className="flex h-screen flex-col overflow-hidden">
      {/* top bar */}
      <motion.header initial={{ y: -30, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ duration: 0.5 }}
        className="relative z-30 flex items-center justify-between border-b border-line/70 px-5 py-3">
        <Link href="/" className="flex items-center gap-2"><LogoMark size={24} /><Wordmark className="text-[16px]" /></Link>
        <div className="absolute left-1/2 -translate-x-1/2"><StatusIsland phase={s.phase} status={s.status} /></div>
        <div className="flex items-center gap-3 text-xs text-muted">
          <span className="hidden font-mono lg:inline">{s.models.slice(0, 2).map((m) => m.split(":").pop()).join(" → ")}</span>
          <span className="flex items-center gap-1.5"><span className={`h-2 w-2 rounded-full ${connected ? "bg-live" : "bg-danger"}`} />{connected ? "live" : "offline"}</span>
        </div>
      </motion.header>

      <div className="grid min-h-0 flex-1 lg:grid-cols-[1fr_420px]">
        {/* map */}
        <motion.section initial={{ opacity: 0, scale: 0.97 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.8, delay: 0.15 }}
          className="dot-grid relative min-h-0 overflow-hidden">
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(124,58,237,.10),transparent_65%)]" />
          <div className="absolute inset-0 p-4"><NeuralMap s={s} onPulseDone={onPulseDone} /></div>
          <div className="pointer-events-none absolute top-5 left-6"><LiveCounter live={s.live.length} total={s.caps.length || 0} /></div>
          <div className="absolute bottom-5 left-6 flex flex-wrap items-end gap-8">
            <Stats stats={s.stats} />
          </div>
          <div className="absolute right-5 bottom-5 flex flex-wrap justify-end gap-4 text-[11px] text-muted">
            {[["#38d6f5", "read"], ["#ffb547", "writes"], ["#6ef2c0", "grafted"], ["#3a4a6b", "dormant"], ["#ffd84d", "new"], ["#a78bfa", "fused"]].map(([c, l]) => (
              <span key={l} className="flex items-center gap-1.5"><i className="h-2 w-2 rounded-full" style={{ background: c }} />{l}</span>
            ))}
          </div>
        </motion.section>

        {/* side panel */}
        <motion.aside initial={{ x: 40, opacity: 0 }} animate={{ x: 0, opacity: 1 }} transition={{ duration: 0.6, delay: 0.25 }}
          className="flex min-h-0 flex-col gap-3 border-l border-line/70 bg-night/60 p-4">
          <div className="glass rounded-2xl p-3">
            <textarea value={q} onChange={(e) => setQ(e.target.value)} rows={3}
              onKeyDown={(e) => { if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) submit(); }}
              className="w-full resize-none bg-transparent text-[14px] leading-relaxed text-text outline-none placeholder:text-muted"
              placeholder="Ask about Meridian's operations…" />
            <div className="mt-2 flex items-center gap-2">
              <motion.button whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.96 }} onClick={submit} disabled={s.busy || !connected}
                className="relative overflow-hidden rounded-xl bg-violet px-4 py-2 text-sm font-semibold text-[#160d33] disabled:opacity-40">
                {s.busy ? "Working…" : "Ask agent"}
                {s.busy && <span className="shimmer absolute inset-0" />}
              </motion.button>
              <button onClick={async () => { setWarming(true); await prewarm(); setWarming(false); }} disabled={warming || !connected}
                title="Synapse builds every read-only surface up front; nothing is exposed to the agent"
                className="rounded-xl border border-line px-3 py-2 text-xs text-muted transition hover:text-text disabled:opacity-40">
                {warming ? "Prewarming…" : "Prewarm"}
              </button>
              <span className="ml-auto font-mono text-[10px] text-muted">Ctrl ⏎</span>
            </div>
            {err && <p className="mt-2 text-xs text-danger">{err}</p>}
          </div>
          <div className="flex flex-wrap gap-1.5">
            {EXAMPLES.slice(1).map((ex) => (
              <motion.button key={ex} whileHover={{ y: -2 }} onClick={() => setQ(ex)}
                className="max-w-full truncate rounded-full border border-line px-2.5 py-1 text-[11px] text-muted transition hover:border-violet/60 hover:text-text">{ex}</motion.button>
            ))}
          </div>
          <AnswerCard s={s} />
          <div className="min-h-0 flex-1 overflow-y-auto rounded-2xl border border-line/60 bg-ink/40 p-3">
            <p className="mb-2 text-[11px] tracking-[0.2em] text-muted uppercase">Nervous system</p>
            {s.lines.length ? <Timeline lines={s.lines} /> : <p className="font-mono text-xs text-muted">0 tools live. Ask a question and watch Synapse grow the connections.</p>}
          </div>
        </motion.aside>
      </div>

      <ApprovalSheet approvals={s.approvals} />
      <Toasts toasts={s.toasts} dismiss={dismissToast} />
    </div>
  );
}
