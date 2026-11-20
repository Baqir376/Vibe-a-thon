"use client";

import { AnimatePresence, animate, motion } from "motion/react";
import { useEffect, useState } from "react";
import { approve } from "@/lib/api";
import type { Approval, ConsoleState, Line, Phase, Toast, Tone } from "@/lib/useConsole";

export const TONE: Record<Tone, string> = {
  violet: "#ff7a45", live: "#8fd18a", read: "#7d95ff", write: "#f2c14e", drift: "#ffd166", danger: "#ff6b57", muted: "#a39887",
};
const PHASE_TONE: Record<Phase, Tone> = {
  offline: "danger", idle: "live", thinking: "violet", searching: "read", building: "violet", calling: "read",
  approval: "write", pruning: "muted", fusing: "violet", sentinel: "drift", done: "live", error: "danger",
};

/** Dynamic-island style status pill: morphs width and colour with what the agent is doing. */
export function StatusIsland({ phase, status }: { phase: Phase; status: string }) {
  const c = TONE[PHASE_TONE[phase]];
  const busy = !["idle", "done", "offline", "error"].includes(phase);
  return (
    <motion.div layout transition={{ type: "spring", stiffness: 380, damping: 32 }}
      className="flex items-center gap-3 overflow-hidden rounded-full border bg-[#120f0b]/90 px-4 py-2 shadow-[0_10px_40px_rgba(0,0,0,.5)] backdrop-blur"
      style={{ borderColor: c + "55" }}>
      <motion.span layout className="relative flex h-2.5 w-2.5 shrink-0">
        {busy && <span className="absolute inline-flex h-full w-full animate-ping rounded-full opacity-70" style={{ background: c }} />}
        <span className="relative inline-flex h-2.5 w-2.5 rounded-full" style={{ background: c, boxShadow: `0 0 10px ${c}` }} />
      </motion.span>
      <AnimatePresence mode="popLayout" initial={false}>
        <motion.span key={status} layout initial={{ y: 14, opacity: 0, filter: "blur(4px)" }} animate={{ y: 0, opacity: 1, filter: "blur(0px)" }}
          exit={{ y: -14, opacity: 0, filter: "blur(4px)" }} transition={{ duration: 0.25 }}
          className="max-w-[46vw] truncate font-mono text-[12.5px] text-text">{status}</motion.span>
      </AnimatePresence>
    </motion.div>
  );
}

export function LiveCounter({ live, total }: { live: number; total: number }) {
  const [v, setV] = useState(live);
  useEffect(() => { const c = animate(v, live, { duration: 0.5, onUpdate: (x) => setV(Math.round(x)) }); return () => c.stop(); }, [live]); // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <div>
      <div className="font-display text-6xl leading-none font-bold tracking-tight">
        <span className={live ? "text-live drop-shadow-[0_0_18px_rgba(143,209,138,.5)]" : "text-text"}>{v}</span>
        <span className="text-2xl text-muted"> / {total}</span>
      </div>
      <p className="mt-1 text-[11px] tracking-[0.22em] text-muted uppercase">live tools</p>
    </div>
  );
}

export function Stats({ stats }: { stats: ConsoleState["stats"] }) {
  const items: [string, number][] = [["Synapse builds", stats.builds], ["grafts", stats.grafts], ["tool calls", stats.calls], ["peak tools", stats.peak]];
  return (
    <div className="flex gap-6">
      {items.map(([l, n]) => (
        <div key={l}>
          <motion.p key={n} initial={{ y: -8, opacity: 0 }} animate={{ y: 0, opacity: 1 }} className="font-mono text-xl font-semibold">{n}</motion.p>
          <p className="text-[10.5px] tracking-wider text-muted uppercase">{l}</p>
        </div>
      ))}
    </div>
  );
}

export function md(text: string) {
  const esc = (x: string) => x.replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" }[c]!));
  const inline = (x: string) => esc(x)
    .replace(/\*\*([^*]+)\*\*/g, "<b class='text-text'>$1</b>")
    .replace(/(^|[^*])\*([^*\n]+)\*/g, "$1<i>$2</i>")
    .replace(/`([^`]+)`/g, "<code class='font-mono text-violet'>$1</code>")
    .replace(/[\[【]([a-z_]+(?:\.|__)[a-z_0-9]+)[\]】]/g, "<span class='cite'>$1</span>");
  const blocks: { html: string; li: boolean }[] = [];
  for (const raw of text.split(/\n/)) {
    const ln = raw.trim();
    if (!ln || /^\|?[-:| ]+\|?$/.test(ln)) continue;
    const m = ln.match(/^[-*•]\s+(.*)/);
    if (m) blocks.push({ html: inline(m[1]), li: true });
    else if (ln.startsWith("|")) blocks.push({ html: inline(ln.split("|").filter(Boolean).map((c) => c.trim()).join("  ·  ")), li: true });
    else blocks.push({ html: inline(ln.replace(/^#+\s*/, "")), li: false });
  }
  return blocks;
}

export function AnswerCard({ s }: { s: ConsoleState }) {
  const blocks = md(s.answer);
  return (
    <AnimatePresence mode="wait">
      {s.question && (
        <motion.div key={s.question} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
          className={`relative overflow-hidden rounded-2xl border border-white/8 bg-black/25 p-4 ${s.busy ? "border-flow" : ""}`} data-active={s.busy} data-testid="answer" aria-live="polite">
          <p className="text-[11px] tracking-[0.2em] text-muted uppercase">Answer</p>
          {!s.answer && s.busy && (
            <div className="mt-3 space-y-2">
              {[92, 78, 85].map((w, i) => <div key={i} className="shimmer h-3 rounded bg-panel" style={{ width: `${w}%` }} />)}
            </div>
          )}
          <div className="mt-2 space-y-1.5 text-[13.5px] leading-relaxed text-text/85 [&_.cite]:ml-1 [&_.cite]:rounded [&_.cite]:bg-live/10 [&_.cite]:px-1 [&_.cite]:font-mono [&_.cite]:text-[10.5px] [&_.cite]:text-live">
            {blocks.map((b, i) => (
              <motion.div key={i} initial={{ opacity: 0, y: 6, filter: "blur(4px)" }} animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
                transition={{ delay: i * 0.07, duration: 0.35 }}
                className={b.li ? "relative pl-4 before:absolute before:top-[0.6em] before:left-0 before:h-1.5 before:w-1.5 before:rounded-full before:bg-violet" : ""}
                dangerouslySetInnerHTML={{ __html: b.html }} />
            ))}
          </div>
          {s.meta && <p className={`mt-3 font-mono text-[10.5px] ${s.phase === "error" ? "text-danger" : "text-muted"}`}>{s.meta}</p>}
        </motion.div>
      )}
    </AnimatePresence>
  );
}

export function Timeline({ lines }: { lines: Line[] }) {
  return (
    <div className="space-y-1">
      <AnimatePresence initial={false}>
        {lines.slice(0, 60).map((l) => (
          <motion.div key={l.id} layout initial={{ opacity: 0, x: 16, height: 0 }} animate={{ opacity: 1, x: 0, height: "auto" }}
            transition={{ type: "spring", stiffness: 420, damping: 34 }} className="flex gap-2.5 overflow-hidden py-0.5">
            <span className="w-4 shrink-0 text-center font-mono text-xs" style={{ color: TONE[l.tone] }}>{l.icon}</span>
            <div className="min-w-0">
              <p className="truncate font-mono text-[12px]" style={{ color: l.tone === "muted" ? "#a39887" : "#f1eadc" }}>{l.text}</p>
              {l.detail && <p className="truncate font-mono text-[10.5px] text-muted">{l.detail}</p>}
            </div>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}

export function ApprovalSheet({ approvals }: { approvals: Approval[] }) {
  const a = approvals[0];
  return (
    <AnimatePresence>
      {a && (
        <motion.div key={a.id} className="fixed inset-0 z-50 flex items-center justify-center bg-[#0b0907]/70 backdrop-blur-sm"
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
          <motion.div initial={{ scale: 0.9, y: 30, opacity: 0 }} animate={{ scale: 1, y: 0, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }}
            transition={{ type: "spring", stiffness: 300, damping: 24 }}
            className="w-[460px] max-w-[92vw] rounded-3xl border border-write/40 bg-panel p-6 shadow-[0_0_80px_rgba(242,193,78,.18)]">
            <div className="flex items-center gap-3">
              <motion.span animate={{ scale: [1, 1.15, 1] }} transition={{ repeat: Infinity, duration: 1.6 }}
                className="flex h-9 w-9 items-center justify-center rounded-full bg-write/15 text-write">⚠</motion.span>
              <div>
                <p className="font-display text-lg font-semibold">{a.kind === "graft" ? "Grant write access?" : "Allow this action?"}</p>
                <p className="text-xs text-muted">{a.kind === "graft" ? `Synapse will graft data-changing endpoints of ${a.detail.system}` : `${a.detail.system} · ${a.detail.endpoint}`}</p>
              </div>
            </div>
            <pre className="mt-4 max-h-56 overflow-auto rounded-xl bg-ink p-3 font-mono text-[12px] text-text/90">
              {JSON.stringify(a.kind === "graft" ? { endpoints: a.detail.endpoints, reason: a.detail.reason } : a.detail.args, null, 2)}
            </pre>
            <div className="mt-5 flex justify-end gap-2">
              <motion.button whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }} onClick={() => approve(a.id, false)}
                className="rounded-xl border border-line px-4 py-2 text-sm text-muted hover:text-text">Decline</motion.button>
              <motion.button whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }} onClick={() => approve(a.id, true)}
                className="rounded-xl bg-write px-5 py-2 text-sm font-semibold text-[#2a1800]">Approve</motion.button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

export function Toasts({ toasts, dismiss }: { toasts: Toast[]; dismiss: (id: number) => void }) {
  return (
    <div className="pointer-events-none fixed top-20 right-5 z-40 flex w-[340px] flex-col gap-2">
      <AnimatePresence>
        {toasts.map((t) => <ToastItem key={t.id} t={t} dismiss={dismiss} />)}
      </AnimatePresence>
    </div>
  );
}

function ToastItem({ t, dismiss }: { t: Toast; dismiss: (id: number) => void }) {
  useEffect(() => { const x = setTimeout(() => dismiss(t.id), 6000); return () => clearTimeout(x); }, [t.id, dismiss]);
  const c = TONE[t.tone];
  return (
    <motion.div layout initial={{ opacity: 0, x: 60, scale: 0.9 }} animate={{ opacity: 1, x: 0, scale: 1 }} exit={{ opacity: 0, x: 60 }}
      transition={{ type: "spring", stiffness: 320, damping: 26 }}
      className="pointer-events-auto overflow-hidden rounded-2xl border bg-panel/95 p-4 backdrop-blur" style={{ borderColor: c + "66", boxShadow: `0 0 40px ${c}22` }}>
      <p className="text-sm font-semibold" style={{ color: c }}>{t.title}</p>
      <p className="mt-1 font-mono text-[11.5px] text-muted">{t.body}</p>
      <motion.div className="mt-3 h-0.5 origin-left rounded" style={{ background: c }} initial={{ scaleX: 1 }} animate={{ scaleX: 0 }} transition={{ duration: 6, ease: "linear" }} />
    </motion.div>
  );
}
