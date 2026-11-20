"use client";

import { AnimatePresence, motion } from "motion/react";
import { useEffect, useRef, useState } from "react";
import type { ReplayMeta } from "@/lib/api";
import type { ConsoleState, Phase } from "@/lib/useConsole";
import { AnswerCard, Timeline } from "./Panels";

/* Plain-language framing for the recorded scenarios (the data keeps its technical titles). */
const CASES: Record<string, { title: string; systems: string[] }> = {
  delayed: { title: "A delivery is late. Who's affected?", systems: ["orders", "tickets", "roster"] },
  refund: { title: "Refund a late order, safely", systems: ["tickets", "fused tool"] },
  "live-update": { title: "A new feature ships mid-demo", systems: ["orders", "new endpoint"] },
};

/* What the agent is doing, in plain words. */
const NARRATE: Record<Phase, [string, string]> = {
  offline: ["Asleep", "Pick a question to wake it."],
  idle: ["Ready", "It holds zero tools until a question needs one."],
  thinking: ["Thinking", "Working out which information it needs."],
  searching: ["Looking it up", "Finding which company system knows the answer."],
  building: ["Growing a tool", "Synapse is turning that system's code into a tool, right now."],
  calling: ["Asking a system", "Using the new tool to fetch real data."],
  approval: ["Needs your OK", "This would change data, so a human approves first."],
  pruning: ["Letting go", "Disconnecting tools it no longer needs."],
  fusing: ["Learning a shortcut", "Combining repeated steps into one safe tool."],
  sentinel: ["Something changed", "A developer shipped a new feature; the agent picks it up."],
  done: ["Done", "Answered, and back to zero tools."],
  error: ["Something went wrong", "Try again, or watch a recorded run."],
};

type Props = {
  s: ConsoleState; mode: string; busy: boolean; scenarios: ReplayMeta[];
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
      <Steps step={step} />

      <AnimatePresence mode="wait">
        {step === 0 ? (
          <motion.div key="pick" className="flex flex-col gap-3" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}>
            <div>
              <h2 className="font-display text-[26px] leading-[1.05] font-semibold tracking-tight">
                What should it <i className="font-normal text-violet">figure out?</i>
              </h2>
              <p className="mt-2 text-[13px] leading-snug text-muted">
                It starts with <span className="text-text underline decoration-violet decoration-2 underline-offset-2">no tools</span>.
                Pick a case and watch it grow only the ones it needs.
              </p>
            </div>

            <div className="flex flex-col gap-2.5">
              {p.scenarios.map((sc, i) => {
                const c = CASES[sc.id] ?? { title: sc.title, systems: [] };
                return (
                  <motion.button key={sc.id} onClick={() => start(sc)} disabled={busy || mode === "checking"} data-cursor={mode === "replay" ? "Play" : "Run"}
                    initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.07 * i }}
                    whileHover="hover" whileTap={{ scale: 0.985 }}
                    className="index-card group relative flex w-full items-stretch gap-0 overflow-hidden rounded-xl border border-line text-left transition-shadow hover:shadow-[4px_4px_0_var(--color-violet)] disabled:opacity-50">
                    <span className="flex w-[39px] shrink-0 items-start justify-center pt-3 font-mono text-[11px] text-violet">{String(i + 1).padStart(2, "0")}</span>
                    <span className="min-w-0 flex-1 py-3 pr-3 pl-3">
                      <span className="block font-display text-[16.5px] leading-snug font-semibold">{c.title}</span>
                      <span className="sr-only"> ({sc.title})</span>
                      <span className="mt-1 line-clamp-2 block text-[12px] leading-snug text-muted italic">&ldquo;{sc.question}&rdquo;</span>
                      <span className="mt-2 block font-mono text-[10px] tracking-[0.14em] text-muted uppercase">
                        touches {c.systems.join(" · ")}
                      </span>
                    </span>
                    <span aria-hidden className="flex w-12 shrink-0 items-center justify-center border-l border-dashed border-line">
                      <motion.svg width="20" height="20" viewBox="0 0 20 20" className="text-text" variants={{ hover: { x: 3 } }}>
                        <circle cx="10" cy="10" r="9" fill="none" stroke="currentColor" strokeWidth="1.3" opacity=".35" />
                        <path d="M8 6.5 L13 10 L8 13.5 Z" fill="currentColor" />
                      </motion.svg>
                    </span>
                  </motion.button>
                );
              })}
            </div>

            {mode === "live" ? (
              <Composer q={p.q} setQ={p.setQ} busy={busy} serverUp={p.serverUp} err={p.err} onAsk={() => start(null, p.q)} warming={p.warming} onPrewarm={p.onPrewarm} />
            ) : (
              <p className="border-l-2 border-line pl-3 text-[12px] leading-relaxed text-muted">
                These are real runs, recorded and replayed. Switch to <b className="font-semibold text-text">Live</b> at the top to ask your own.
              </p>
            )}
          </motion.div>
        ) : (
          <motion.div key="run" className="flex flex-col gap-4" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}>
            <figure className="relative pl-7">
              <span className="absolute top-0 left-0 font-display text-[22px] leading-none font-semibold text-violet italic">Q.</span>
              <blockquote className="font-display text-[16px] leading-snug text-text italic">{s.question}</blockquote>
            </figure>

            {step === 1 ? <Now phase={s.phase} detail={s.status} beat={s.lines.length} /> : <Report s={s} />}

            <AnswerCard s={s} />

            {step === 2 && (
              <motion.button initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.4 }} whileTap={{ scale: 0.97 }}
                onClick={() => setPicking(true)}
                className="group flex items-center justify-center gap-2 rounded-full border border-text bg-text px-4 py-2.5 text-sm font-semibold text-ink transition hover:bg-transparent hover:text-text">
                Try another case <span aria-hidden className="transition group-hover:translate-x-1">→</span>
              </motion.button>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      <div className="mt-auto border-t border-dashed border-line pt-2">
        <button onClick={() => setShowLog((v) => !v)} aria-expanded={showLog}
          className="flex w-full items-center justify-between py-1.5 text-left font-mono text-[11px] tracking-wider text-muted uppercase transition hover:text-text">
          <span>Raw log · {s.lines.length} events</span>
          <span aria-hidden>{showLog ? "hide −" : "show +"}</span>
        </button>
        <AnimatePresence initial={false}>
          {showLog && (
            <motion.div initial={{ height: 0 }} animate={{ height: "auto" }} exit={{ height: 0 }} className="overflow-hidden">
              <div className="max-h-[220px] overflow-y-auto pb-2">
                {s.lines.length ? <Timeline lines={s.lines} /> : <p className="font-mono text-xs text-muted">Every Synapse build, call and prune lands here.</p>}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

/** Three tabs with an ink underline that slides to the current step. */
function Steps({ step }: { step: number }) {
  const steps = ["Ask", "Watch", "Answer"];
  return (
    <ol className="grid grid-cols-3 border-b border-line" aria-label="Progress">
      {steps.map((l, i) => (
        <li key={l} aria-current={i === step ? "step" : undefined} className="relative pb-2.5">
          <span className={`flex items-baseline gap-1.5 text-[13px] transition-colors ${i === step ? "text-text" : i < step ? "text-muted" : "text-muted/60"}`}>
            <span className="font-mono text-[10px]">{i < step ? "✓" : `0${i + 1}`}</span>
            <span className={i === step ? "font-display font-semibold" : ""}>{l}</span>
          </span>
          {i === step && <motion.span layoutId="step-ink" className="absolute right-3 -bottom-px left-0 h-[2.5px] rounded-full bg-violet"
            transition={{ type: "spring", stiffness: 380, damping: 30 }} />}
        </li>
      ))}
    </ol>
  );
}

/** Live narration with an "action potential" trace that spikes on every agent event. */
function Now({ phase, detail, beat }: { phase: Phase; detail: string; beat: number }) {
  const [title, body] = NARRATE[phase] ?? NARRATE.thinking;
  return (
    <div className="overflow-hidden rounded-xl border border-line bg-[var(--well)]" aria-live="polite">
      <div className="flex items-center justify-between px-3.5 pt-3">
        <span className="flex items-center gap-2 font-mono text-[10px] tracking-[0.22em] text-violet uppercase">
          <span className="relative flex h-1.5 w-1.5"><span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-violet opacity-75" /><span className="relative h-1.5 w-1.5 rounded-full bg-violet" /></span>
          live
        </span>
        <span className="font-mono text-[10px] text-muted">{beat} events</span>
      </div>
      <Trace beat={beat} />
      <div className="px-3.5 pb-3.5">
        <AnimatePresence mode="wait">
          <motion.div key={phase} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.22 }}>
            <p className="font-display text-[21px] leading-tight font-semibold">{title}</p>
            <p className="mt-0.5 text-[12.5px] leading-snug text-muted">{body}</p>
          </motion.div>
        </AnimatePresence>
        <p className="mt-2 truncate font-mono text-[10.5px] text-muted/80">{detail}</p>
      </div>
    </div>
  );
}

/** A scrolling membrane-potential trace: quiet noise, with a spike each time `beat` changes. */
function Trace({ beat }: { beat: number }) {
  const path = useRef<SVGPathElement>(null);
  const kick = useRef(0);
  useEffect(() => { kick.current = 1; }, [beat]);
  useEffect(() => {
    const N = 90, W = 360, H = 56, buf = new Array(N).fill(0);
    let raf = 0, t = 0, phase = 0, last = 0;
    const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
    const tick = (now: number) => {
      raf = requestAnimationFrame(tick);
      if (now - last < 33) return; // ~30 fps
      last = now; t += 1;
      let v = Math.sin(t * 0.21) * 0.05 + (Math.random() - 0.5) * 0.06;
      if (kick.current > 0 && phase === 0) { phase = 1; kick.current = 0; }
      if (phase) {   // depolarise, overshoot, recover
        const shape = [0.25, 0.9, 1, 0.4, -0.35, -0.25, -0.12, -0.05];
        v += shape[phase - 1] ?? 0;
        phase = phase >= shape.length ? 0 : phase + 1;
      }
      buf.shift(); buf.push(v);
      const d = buf.map((y, i) => `${i ? "L" : "M"}${(i / (N - 1)) * W} ${H / 2 - y * (H * 0.42)}`).join(" ");
      path.current?.setAttribute("d", d);
    };
    if (!reduce) raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);
  return (
    <svg viewBox="0 0 360 56" preserveAspectRatio="none" className="mt-1 block h-14 w-full text-violet" aria-hidden>
      <line x1="0" y1="28" x2="360" y2="28" stroke="currentColor" strokeOpacity=".12" strokeDasharray="2 4" />
      <path ref={path} d="M0 28 L360 28" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round"
        style={{ filter: "drop-shadow(0 0 4px currentColor)" }} />
    </svg>
  );
}

function Report({ s }: { s: ConsoleState }) {
  const items: [number, string][] = [
    [s.stats.grafts, "systems connected"],
    [s.stats.calls, "calls made"],
    [s.live.length, "tools kept"],
  ];
  return (
    <div className="rounded-xl border border-line bg-[var(--well)] p-3.5">
      <p className="font-mono text-[10px] tracking-[0.22em] text-live uppercase">Lab report</p>
      <div className="mt-2 grid grid-cols-3 divide-x divide-dashed divide-line">
        {items.map(([n, l], i) => (
          <motion.div key={l} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 * i }} className="px-2 first:pl-0">
            <p className="font-display text-[30px] leading-none font-semibold">{n}</p>
            <p className="mt-1 text-[11px] leading-tight text-muted">{l}</p>
          </motion.div>
        ))}
      </div>
      <p className="mt-3 font-hand text-[19px] leading-snug text-text/85">grew what it needed, used it, then let it all go.</p>
    </div>
  );
}

function Composer({ q, setQ, busy, serverUp, err, onAsk, warming, onPrewarm }:
  { q: string; setQ: (v: string) => void; busy: boolean; serverUp: boolean; err: string | null; onAsk: () => void; warming: boolean; onPrewarm: () => void }) {
  return (
    <div className="index-card rounded-xl border border-line p-3 pl-12 transition focus-within:border-violet focus-within:shadow-[4px_4px_0_var(--color-violet)]">
      <label className="mb-1 block font-mono text-[10px] tracking-[0.18em] text-muted uppercase" htmlFor="ask">or write your own</label>
      <textarea id="ask" value={q} onChange={(e) => setQ(e.target.value)} rows={2}
        onKeyDown={(e) => { if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) onAsk(); }}
        className="w-full resize-none bg-transparent font-display text-[15px] leading-[22px] text-text italic outline-none placeholder:text-muted"
        placeholder="Which orders to Mumbai are delayed?" />
      <div className="mt-2 flex items-center gap-2">
        <motion.button whileTap={{ scale: 0.96 }} onClick={onAsk} disabled={busy || !serverUp || !q.trim()}
          className="rounded-full bg-text px-4 py-1.5 text-sm font-semibold text-ink disabled:opacity-40">Ask</motion.button>
        <button onClick={onPrewarm} disabled={warming || !serverUp} title="Builds every read-only tool up front so the first answer is faster"
          className="rounded-full border border-line px-3 py-1.5 text-xs text-muted transition hover:text-text disabled:opacity-40">{warming ? "Warming up…" : "Warm up"}</button>
        <span className="ml-auto font-mono text-[10px] text-muted">Ctrl ⏎</span>
      </div>
      {err && <p className="mt-2 text-xs text-danger">{err}</p>}
    </div>
  );
}
