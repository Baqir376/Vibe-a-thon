"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useEffect, useState } from "react";
import { InkField } from "@/components/InkField";
import { Magnetic } from "@/components/fx/Interactions";

function SpecimenPoster() {
  return (
    <div className="absolute inset-0 flex items-center justify-center" aria-hidden>
      <div className="h-36 w-36 rounded-full bg-[radial-gradient(circle_at_35%_30%,#fffaf0_0%,#efe5d2_45%,#c9bb9f_100%)] shadow-[0_30px_60px_rgba(22,19,15,.18)]" />
    </div>
  );
}
// three.js loads after first paint and only in the browser.
const Specimen = dynamic(() => import("@/components/three/Specimen"), { ssr: false, loading: SpecimenPoster });

/** Seconds until the hero may animate: wait for the boot sequence only when it is actually playing. */
export function useBootDelay() {
  const [base] = useState(() => {
    try { return typeof window !== "undefined" && sessionStorage.getItem("synapto-boot") === "1" ? 0.15 : 2.5; }
    catch { return 0.15; }
  });
  return base;
}

const rise = (d: number) => ({ initial: { opacity: 0, y: 28 }, animate: { opacity: 1, y: 0 }, transition: { delay: d, duration: 0.8, ease: [0.22, 1, 0.36, 1] as const } });

export function Hero() {
  const B = useBootDelay();
  return (
    <section className="relative flex min-h-[100svh] items-center overflow-hidden pt-28 pb-14">
      <InkField />
      <div className="relative mx-auto grid w-full max-w-6xl items-center gap-8 px-5 lg:grid-cols-[1.08fr_.92fr]">
        <div className="relative">
          <motion.div {...rise(B)} className="mb-7 flex items-center gap-3">
            <motion.span initial={{ rotate: -14, scale: 1.6, opacity: 0 }} animate={{ rotate: -4, scale: 1, opacity: 1 }}
              transition={{ delay: B + 0.25, type: "spring", stiffness: 260, damping: 14 }}
              className="stamp inline-block px-2.5 py-1 text-[11px] text-signal-ink">Track 4 · Open innovation</motion.span>
            <span className="font-mono text-xs text-graphite">built on <span className="text-carbon">Synapse CLI</span></span>
          </motion.div>

          <h1 className="font-display text-[clamp(3rem,6.6vw,5.6rem)] leading-[0.95] font-semibold tracking-[-0.03em] text-carbon">
            <motion.span {...rise(B + 0.1)} className="block">Agents that</motion.span>
            <motion.span {...rise(B + 0.2)} className="relative mr-[0.12em] inline-block pr-[0.04em] italic text-signal" style={{ fontVariationSettings: '"SOFT" 100, "WONK" 1' }}>
              grow
              <svg className="absolute -bottom-3 left-0 h-4 w-full" viewBox="0 0 200 16" preserveAspectRatio="none" aria-hidden>
                <motion.path d="M2 11 C 40 3, 90 15, 130 8 S 185 5, 198 9" fill="none" stroke="#e8551f" strokeWidth="3.2" strokeLinecap="round"
                  initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ delay: B + 0.9, duration: 0.8, ease: "easeInOut" }} />
              </svg>
            </motion.span>{" "}
            <motion.span {...rise(B + 0.3)} className="inline-block">their own</motion.span>
            <motion.span {...rise(B + 0.4)} className="block">tools.</motion.span>
          </h1>

          <motion.p {...rise(B + 0.6)} className="mt-8 max-w-xl text-lg leading-relaxed text-graphite">
            Synaptogenesis starts with <b className="text-carbon">zero</b> tools. When a question needs a legacy system, the
            agent runs <code className="rounded bg-paper-3 px-1.5 py-0.5 font-mono text-[0.9em] text-carbon">synapse build</code> itself,
            grafts only the endpoints it needs, answers, and prunes the access.
          </motion.p>

          <motion.div {...rise(B + 0.75)} className="mt-9 flex flex-wrap items-center gap-4">
            <Magnetic>
              <Link href="/app" data-cursor="Launch"
                className="group inline-flex items-center gap-2.5 rounded-full bg-carbon px-7 py-3.5 font-semibold text-paper shadow-[4px_4px_0_#e8551f] transition-transform active:translate-x-[2px] active:translate-y-[2px] active:shadow-[2px_2px_0_#e8551f]">
                Launch the app
                <motion.span animate={{ x: [0, 4, 0] }} transition={{ repeat: Infinity, duration: 1.6 }}>→</motion.span>
              </Link>
            </Magnetic>
            <Magnetic>
              <a href="#preview" data-cursor="Watch"
                className="inline-flex rounded-full border-[1.5px] border-carbon px-7 py-3.5 font-semibold text-carbon transition hover:bg-carbon hover:text-paper">
                See a run
              </a>
            </Magnetic>
          </motion.div>

          <motion.p {...rise(B + 1)} className="mt-8 font-hand text-2xl text-graphite">
            “Every other team used Synapse to build an agent.<br />We built an agent that uses Synapse.”
          </motion.p>
        </div>

        <motion.figure initial={{ opacity: 0, rotate: 3, y: 40 }} animate={{ opacity: 1, rotate: 1.2, y: 0 }}
          transition={{ delay: B + 0.35, duration: 1.1, ease: [0.22, 1, 0.36, 1] }}
          className="card-paper relative mx-auto w-full max-w-[520px] rounded-[18px] p-3">
          <div className="graph-paper relative aspect-[1/1] overflow-hidden rounded-[12px] border border-rule bg-paper">
            <Specimen />
          </div>
          <figcaption className="flex items-baseline justify-between px-1 pt-3 font-mono text-[11px] text-graphite">
            <span><b className="text-carbon">Fig. 1</b> · the agent grafting two systems, live</span>
            <span>drag · poke</span>
          </figcaption>
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: B + 1.6 }}
            className="pointer-events-none absolute -bottom-20 -left-36 hidden w-56 rotate-[-6deg] font-hand text-2xl leading-tight text-signal lg:block">
            move your mouse over the paper. it grows neurons!
            <svg className="absolute -top-14 left-24 h-14 w-20" viewBox="0 0 80 56" aria-hidden>
              <motion.path d="M6 50 C 20 20, 44 10, 74 6" fill="none" stroke="#e8551f" strokeWidth="2.2" strokeLinecap="round"
                initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ delay: B + 1.9, duration: 0.7 }} />
              <motion.path d="M64 2 L 75 6 L 66 14" fill="none" stroke="#e8551f" strokeWidth="2.2" strokeLinecap="round"
                initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ delay: B + 2.5, duration: 0.3 }} />
            </svg>
          </motion.div>
        </motion.figure>
      </div>
    </section>
  );
}

/* A looping, scripted replay of a real run: search → Synapse build → tools grow → answer → prune. (Night-lab colours.) */
const SCRIPT: { t: string; c?: string; tools?: number; pause?: number }[] = [
  { t: "› Which customers are hit by the delayed Pune insulin shipment?", c: "text-text", tools: 0, pause: 900 },
  { t: "  find_capability  → orders · tickets · roster", c: "text-muted", pause: 700 },
  { t: '  $ synapse build --auto --endpoints "GET /shipments/delayed,…"', c: "text-violet", pause: 500 },
  { t: "  ✓ orders grafted   2 tools   0.4 s", c: "text-live", tools: 2, pause: 450 },
  { t: "  ✓ tickets grafted  1 tool    0.4 s", c: "text-live", tools: 3, pause: 450 },
  { t: "  ✓ roster grafted   1 tool    0.0 s (dormant)", c: "text-live", tools: 4, pause: 700 },
  { t: "  → 6 parallel calls across 3 systems", c: "text-read", pause: 900 },
  { t: "  ✔ CUS-101, CUS-102, CUS-103 · TKT-9001, TKT-9002 · on call: Priya", c: "text-text", pause: 1200 },
  { t: "  ✂ pruned → tools back to 0", c: "text-muted", tools: 0, pause: 2200 },
];

export function GraftTerminal({ startAfter }: { startAfter: number }) {
  const reduce = useReducedMotion();
  const [n, setN] = useState(reduce ? SCRIPT.length : 0);
  const [tools, setTools] = useState(0);
  useEffect(() => {
    if (reduce) return; // reduced motion: show the whole transcript, no loop
    let i = 0, alive = true;
    const run = () => {
      if (!alive) return;
      const step = SCRIPT[i];
      setN(i + 1);
      if (step.tools !== undefined) setTools(step.tools);
      i = (i + 1) % SCRIPT.length;
      setTimeout(() => { if (i === 0) setN(0); run(); }, step.pause ?? 600);
    };
    const start = setTimeout(run, startAfter * 1000 + 1000);
    return () => { alive = false; clearTimeout(start); };
  }, [startAfter, reduce]);

  return (
    <div className="relative overflow-hidden rounded-2xl bg-ink">
      <p className="sr-only">Replay of a recorded run: the agent finds orders, tickets and roster endpoints, Synapse grafts 4 tools,
        6 calls run in parallel, the answer lists customers CUS-101 to CUS-103 and tickets TKT-9001 and TKT-9002, then all tools are pruned.</p>
      <div aria-hidden className="contents">
      <div className="flex items-center justify-between border-b border-line px-4 py-2.5">
        <span className="font-mono text-[11px] text-muted">synaptogenesis · live graft</span>
        <div className="flex items-center gap-2 font-mono text-[11px]">
          <span className="text-muted">tools</span>
          <div className="flex gap-0.5">
            {Array.from({ length: 6 }, (_, i) => (
              <motion.span key={i} className="h-3 w-1.5 rounded-sm" animate={{ backgroundColor: i < tools ? "#8fd18a" : "#2e2820" }}
                transition={{ type: "spring", stiffness: 300, damping: 20 }} />
            ))}
          </div>
          <span className="w-12 text-text">{tools} / 39</span>
        </div>
      </div>
      <div className="h-[290px] space-y-1.5 overflow-hidden p-4 font-mono text-[12.5px] leading-relaxed">
        <AnimatePresence initial={false}>
          {SCRIPT.slice(0, n).map((s, i) => (
            <motion.div key={`${i}-${s.t}`} className={`${s.c} whitespace-pre`}
              initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.3 }}>
              {s.t}
            </motion.div>
          ))}
        </AnimatePresence>
        <motion.span className="inline-block h-4 w-2 bg-violet/80 align-middle" animate={{ opacity: [1, 0, 1] }} transition={{ repeat: Infinity, duration: 1 }} />
      </div>
      </div>
    </div>
  );
}
