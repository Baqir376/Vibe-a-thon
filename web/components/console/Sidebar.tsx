"use client";

import { AnimatePresence, motion } from "motion/react";
import { useState } from "react";
import type { ReplayMeta } from "@/lib/api";
import type { ConsoleState, Phase } from "@/lib/useConsole";
import { AnswerCard, Timeline } from "./Panels";

/* Friendly framing for the recorded scenarios (the data keeps its technical titles). */
const FRIENDLY: Record<string, { emoji: string; title: string; tint: string; systems: [string, string][] }> = {
  delayed: { emoji: "📦", title: "A delivery is late. Who's affected?", tint: "#7d95ff",
    systems: [["Orders", "#7d95ff"], ["Tickets", "#f2c14e"], ["Roster", "#c792ea"]] },
  refund: { emoji: "💸", title: "Refund a late order, safely", tint: "#f2c14e",
    systems: [["Tickets", "#f2c14e"], ["Fused tool", "#ff7a45"]] },
  "live-update": { emoji: "✨", title: "A new feature ships mid-demo", tint: "#8fd18a",
    systems: [["Orders", "#7d95ff"], ["New endpoint", "#ffd166"]] },
};

/* What the agent is doing, in plain words. */
const NARRATE: Record<Phase, [string, string, string]> = {
  offline: ["😴", "Waiting to start", "Pick a question to wake the agent."],
  idle: ["🌱", "Ready", "It holds zero tools until a question needs one."],
  thinking: ["🧠", "Thinking", "Working out which information it needs."],
  searching: ["🔎", "Looking things up", "Searching the company's systems for the right data."],
  building: ["🔧", "Building a tool", "Synapse is turning that system's code into a tool, right now."],
  calling: ["📡", "Asking a system", "Using the new tool to fetch real data."],
  approval: ["✋", "Needs your OK", "This would change data, so a human approves first."],
  pruning: ["✂️", "Cleaning up", "Disconnecting tools it no longer needs."],
  fusing: ["🧬", "Learning a shortcut", "Combining repeated steps into one safe tool."],
  sentinel: ["🆕", "Something changed", "A developer shipped a new feature; the agent learns it."],
  done: ["✅", "Done", "Answered, and back to zero tools."],
  error: ["⚠️", "Something went wrong", "Try again, or watch a recorded run."],
};

type Props = {
  s: ConsoleState; mode: string; busy: boolean; replaying: string | null; scenarios: ReplayMeta[];
  run: (sc: ReplayMeta | null, text?: string) => void;
  q: string; setQ: (v: string) => void; err: string | null; serverUp: boolean;
  warming: boolean; onPrewarm: () => void;
};

export function Sidebar(p: Props) {
  const { s, mode, busy } = p;
  const [picking, setPicking] = useState(false);
  const [showLog, setShowLog] = useState(false);
  const step = picking || !s.question ? 0 : busy ? 1 : 2;
  const start = (sc: ReplayMeta | null, text?: string) => { setPicking(false); p.run(sc, text); };

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4">
      <Journey step={step} />

      <AnimatePresence mode="wait">
        {step === 0 ? (
          <motion.div key="pick" className="flex flex-col gap-3" initial={{ opacity: 0, x: -16 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 16 }}>
            <div className="relative">
              <h2 className="font-display text-[24px] leading-tight font-semibold">Pick a <i className="text-[#ff9a6e]">question</i></h2>
              <p className="mt-1 text-[13px] leading-snug text-muted">
                The agent starts with <b className="text-text">no tools</b>. Watch it build exactly the ones it needs, then let them go.
              </p>
              <motion.span aria-hidden className="pointer-events-none absolute -top-2 right-0 font-hand text-[19px] text-[#ff9a6e]"
                animate={{ rotate: -6, y: [0, -3, 0] }} transition={{ y: { duration: 2.4, repeat: Infinity } }}>tap one ↓</motion.span>
            </div>

            {p.scenarios.map((sc, i) => {
              const f = FRIENDLY[sc.id] ?? { emoji: "💬", title: sc.title, tint: "#ff7a45", systems: [] };
              return (
                <motion.button key={sc.id} onClick={() => start(sc)} disabled={busy || mode === "checking"}
                  data-cursor={mode === "replay" ? "Play" : "Run"}
                  initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.08 * i }}
                  whileHover={{ y: -3 }} whileTap={{ scale: 0.98 }}
                  className="border-flow group relative flex w-full items-center gap-3 overflow-hidden rounded-2xl border border-white/6 bg-white/[0.035] p-3.5 text-left transition hover:bg-white/[0.07] disabled:opacity-50">
                  <span aria-hidden className="pointer-events-none absolute -top-10 -left-10 h-28 w-28 rounded-full opacity-0 blur-2xl transition group-hover:opacity-60" style={{ background: f.tint }} />
                  <motion.span aria-hidden className="relative flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl text-[24px]"
                    style={{ background: f.tint + "22", boxShadow: `inset 0 0 0 1px ${f.tint}44` }}
                    whileHover={{ rotate: [0, -10, 10, 0] }} transition={{ duration: 0.5 }}>{f.emoji}</motion.span>
                  <span className="relative min-w-0 flex-1">
                    <span className="block text-[14.5px] leading-snug font-semibold">{f.title}</span>
                    <span className="sr-only"> ({sc.title})</span>
                    <span className="mt-1.5 flex flex-wrap gap-1.5">
                      {f.systems.map(([n, c]) => (
                        <span key={n} className="flex items-center gap-1 rounded-full border border-white/8 bg-black/20 px-2 py-0.5 text-[10.5px] text-muted">
                          <i className="h-1.5 w-1.5 rounded-full" style={{ background: c }} />{n}
                        </span>
                      ))}
                    </span>
                  </span>
                  <span aria-hidden className="relative flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white text-[13px] text-black shadow-[0_0_0_0_rgba(255,255,255,.5)] transition group-hover:scale-110 group-hover:shadow-[0_0_0_6px_rgba(255,255,255,.08)]">▶</span>
                </motion.button>
              );
            })}

            {mode === "live" ? (
              <Composer q={p.q} setQ={p.setQ} busy={busy} serverUp={p.serverUp} err={p.err} onAsk={() => start(null, p.q)} warming={p.warming} onPrewarm={p.onPrewarm} />
            ) : (
              <p className="flex items-start gap-2 rounded-xl bg-black/20 px-3 py-2.5 text-[12px] leading-relaxed text-muted">
                <span aria-hidden>🎬</span>
                <span>These are <b className="text-text">real recorded runs</b>, replayed. Switch to <b className="text-text">Live</b> (top right) to ask your own.</span>
              </p>
            )}
          </motion.div>
        ) : (
          <motion.div key="run" className="flex min-h-0 flex-1 flex-col gap-3" initial={{ opacity: 0, x: -16 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 16 }}>
            {/* the question, as a chat bubble */}
            <div className="flex justify-end">
              <motion.div initial={{ opacity: 0, y: 10, scale: 0.96 }} animate={{ opacity: 1, y: 0, scale: 1 }}
                className="max-w-[88%] rounded-2xl rounded-br-md bg-[#ff7a45] px-3.5 py-2.5 text-[13px] leading-snug font-medium text-[#1a0d06] shadow-[0_8px_30px_rgba(255,122,69,.25)]">
                {s.question}
              </motion.div>
            </div>

            {step === 1 ? <Narrator phase={s.phase} detail={s.status} /> : <Recap s={s} />}

            <AnswerCard s={s} />

            {step === 2 && (
              <motion.button initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }}
                whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.97 }} onClick={() => setPicking(true)}
                className="rounded-full bg-white px-4 py-2.5 text-sm font-semibold text-black shadow-[0_10px_30px_rgba(255,255,255,.12)]">
                ↺ Try another question
              </motion.button>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* the technical log, for the curious */}
      <div className="mt-auto rounded-2xl border border-white/6 bg-black/25">
        <button onClick={() => setShowLog((v) => !v)} aria-expanded={showLog}
          className="flex w-full items-center justify-between px-3.5 py-2.5 text-left text-[12.5px] text-muted transition hover:text-text">
          <span className="flex items-center gap-2"><span aria-hidden>🧾</span> Under the hood <span className="font-mono text-[10.5px] text-muted/80">({s.lines.length} events)</span></span>
          <motion.span aria-hidden animate={{ rotate: showLog ? 180 : 0 }}>▾</motion.span>
        </button>
        <AnimatePresence initial={false}>
          {showLog && (
            <motion.div initial={{ height: 0 }} animate={{ height: "auto" }} exit={{ height: 0 }} className="overflow-hidden">
              <div className="max-h-[220px] overflow-y-auto px-3.5 pb-3">
                {s.lines.length ? <Timeline lines={s.lines} /> : <p className="font-mono text-xs text-muted">Nothing yet. Every Synapse build, call and prune shows up here.</p>}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

function Journey({ step }: { step: number }) {
  const steps = ["Ask", "Watch it grow", "Answer"];
  return (
    <ol className="relative flex items-start justify-between px-2" aria-label="Progress">
      <div aria-hidden className="absolute top-[15px] right-8 left-8 h-[2px] rounded bg-white/8" />
      <motion.div aria-hidden className="absolute top-[15px] left-8 h-[2px] origin-left rounded bg-gradient-to-r from-[#ff7a45] to-[#8fd18a]"
        style={{ right: 32 }} animate={{ scaleX: step / 2 }} transition={{ type: "spring", stiffness: 120, damping: 20 }} />
      {steps.map((l, i) => {
        const state = i < step ? "done" : i === step ? "now" : "next";
        return (
          <li key={l} aria-current={state === "now" ? "step" : undefined} className="relative z-10 flex w-20 flex-col items-center gap-1.5">
            <motion.span className="flex h-8 w-8 items-center justify-center rounded-full border-2 font-mono text-[12px] font-bold"
              animate={{
                backgroundColor: state === "done" ? "#8fd18a" : state === "now" ? "#ff7a45" : "#1a1612",
                borderColor: state === "next" ? "#3a322a" : "rgba(0,0,0,0)",
                color: state === "next" ? "#a39887" : "#120f0b",
                scale: state === "now" ? 1.12 : 1,
              }} transition={{ type: "spring", stiffness: 300, damping: 20 }}>
              {state === "done" ? "✓" : i + 1}
            </motion.span>
            {state === "now" && (
              <motion.span aria-hidden className="absolute top-0 h-8 w-8 rounded-full border-2 border-[#ff7a45]"
                animate={{ scale: [1, 1.7], opacity: [0.7, 0] }} transition={{ duration: 1.6, repeat: Infinity }} />
            )}
            <span className={`text-center text-[11px] leading-tight ${state === "next" ? "text-muted" : "font-semibold text-text"}`}>{l}</span>
          </li>
        );
      })}
    </ol>
  );
}

function Narrator({ phase, detail }: { phase: Phase; detail: string }) {
  const [emoji, title, body] = NARRATE[phase] ?? NARRATE.thinking;
  return (
    <div className="relative overflow-hidden rounded-2xl border border-[#ff7a45]/25 bg-gradient-to-br from-[#ff7a45]/12 to-transparent p-4" aria-live="polite">
      <p className="mb-2 font-mono text-[10px] tracking-[0.25em] text-[#ff9a6e] uppercase">Right now</p>
      <AnimatePresence mode="wait">
        <motion.div key={phase} className="flex items-start gap-3"
          initial={{ opacity: 0, y: 10, filter: "blur(4px)" }} animate={{ opacity: 1, y: 0, filter: "blur(0px)" }} exit={{ opacity: 0, y: -10, filter: "blur(4px)" }}>
          <motion.span aria-hidden className="text-[30px] leading-none" animate={{ rotate: [0, -8, 8, 0], scale: [1, 1.1, 1] }} transition={{ duration: 1.4, repeat: Infinity }}>{emoji}</motion.span>
          <div className="min-w-0">
            <p className="font-display text-[19px] leading-tight font-semibold">{title}</p>
            <p className="mt-0.5 text-[12.5px] leading-snug text-text/75">{body}</p>
          </div>
        </motion.div>
      </AnimatePresence>
      <p className="mt-3 truncate font-mono text-[10.5px] text-muted">{detail}</p>
      <span aria-hidden className="shimmer absolute inset-x-0 bottom-0 h-[2px]" />
    </div>
  );
}

function Recap({ s }: { s: ConsoleState }) {
  const items: [string, string, string][] = [
    ["🔧", `${s.stats.builds || s.stats.grafts}`, s.stats.builds ? "tools built by Synapse" : "systems connected"],
    ["📡", `${s.stats.calls}`, "questions asked to systems"],
    ["✂️", `${s.live.length}`, "tools still connected"],
  ];
  return (
    <div className="rounded-2xl border border-[#8fd18a]/25 bg-gradient-to-br from-[#8fd18a]/10 to-transparent p-4">
      <p className="mb-3 font-mono text-[10px] tracking-[0.25em] text-[#8fd18a] uppercase">What just happened</p>
      <div className="grid grid-cols-3 gap-2">
        {items.map(([e, n, l], i) => (
          <motion.div key={l} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 * i }}
            className="rounded-xl bg-black/20 p-2.5 text-center">
            <p aria-hidden className="text-lg">{e}</p>
            <p className="font-display text-2xl font-bold">{n}</p>
            <p className="text-[10.5px] leading-tight text-muted">{l}</p>
          </motion.div>
        ))}
      </div>
      <p className="mt-3 font-hand text-[18px] leading-snug text-text/80">grew what it needed, used it, then let it all go. 🌿</p>
    </div>
  );
}

function Composer({ q, setQ, busy, serverUp, err, onAsk, warming, onPrewarm }:
  { q: string; setQ: (v: string) => void; busy: boolean; serverUp: boolean; err: string | null; onAsk: () => void; warming: boolean; onPrewarm: () => void }) {
  return (
    <div className="rounded-2xl border border-white/8 bg-black/25 p-3 transition focus-within:border-[#ff7a45]/50 focus-within:shadow-[0_0_0_4px_rgba(255,122,69,.12)]">
      <label className="mb-1 block text-[11px] text-muted" htmlFor="ask">…or ask your own</label>
      <textarea id="ask" value={q} onChange={(e) => setQ(e.target.value)} rows={2}
        onKeyDown={(e) => { if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) onAsk(); }}
        className="w-full resize-none bg-transparent text-[14px] leading-relaxed text-text outline-none placeholder:text-muted"
        placeholder="e.g. Which orders to Mumbai are delayed?" />
      <div className="mt-2 flex items-center gap-2">
        <motion.button whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.96 }} onClick={onAsk} disabled={busy || !serverUp || !q.trim()}
          className="rounded-full bg-white px-4 py-1.5 text-sm font-semibold text-black disabled:opacity-40">Ask agent</motion.button>
        <button onClick={onPrewarm} disabled={warming || !serverUp} title="Builds every read-only tool up front so the first answer is faster"
          className="rounded-full border border-line px-3 py-1.5 text-xs text-muted transition hover:text-text disabled:opacity-40">{warming ? "Warming up…" : "Warm up"}</button>
        <span className="ml-auto font-mono text-[10px] text-muted">Ctrl ⏎</span>
      </div>
      {err && <p className="mt-2 text-xs text-danger">{err}</p>}
    </div>
  );
}
