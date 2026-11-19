"use client";

import Link from "next/link";
import { AnimatePresence, motion } from "motion/react";
import { useEffect, useState } from "react";
import { NeuralField } from "@/components/NeuralField";
import { Magnetic } from "@/components/fx/Interactions";
import { HeroCore } from "@/components/three/HeroCore";

const LINE_1 = ["Agents", "that", "grow"];
const LINE_2 = ["their", "own", "tools."];

/** Seconds until the hero may animate: wait for the boot sequence only when it is actually playing. */
export function useBootDelay() {
  const [base] = useState(() => {
    try { return typeof window !== "undefined" && sessionStorage.getItem("synapto-boot") === "1" ? 0.15 : 2.6; }
    catch { return 0.15; }
  });
  return base;
}

export function Hero() {
  const B = useBootDelay();
  return (
    <section className="relative flex min-h-[100svh] items-center overflow-hidden pt-28 pb-16">
      <NeuralField className="opacity-80" />
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_70%_55%_at_50%_40%,transparent_0%,#05070d_80%)]" />
      <div className="pointer-events-none absolute -top-40 left-1/2 h-[520px] w-[820px] -translate-x-1/2 rounded-full bg-violet-deep/25 blur-[140px]" />

      <div className="relative mx-auto grid w-full max-w-6xl items-center gap-6 px-5 lg:grid-cols-[1.05fr_.95fr]">
        <div>
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: B + 0.1 }}
            className="glass mb-7 inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs text-muted">
            <span className="relative flex h-2 w-2"><span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-live opacity-75" /><span className="relative inline-flex h-2 w-2 rounded-full bg-live" /></span>
            Vibe-a-thon · Track 4 · powered by <span className="font-mono text-text">Synapse CLI</span>
          </motion.div>

          <h1 className="font-display text-[clamp(2.4rem,5vw,4.15rem)] leading-[1.02] font-extrabold tracking-[-0.035em]">
            {[LINE_1, LINE_2].map((line, li) => (
              <span key={li} className="block whitespace-nowrap">
                {line.map((w, i) => (
                  <motion.span key={w} className={`mr-[0.22em] inline-block ${li === 1 ? "text-gradient" : ""}`}
                    initial={{ opacity: 0, y: 40, filter: "blur(12px)" }}
                    animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
                    transition={{ delay: B + 0.15 + (li * 3 + i) * 0.08, duration: 0.7, ease: [0.22, 1, 0.36, 1] }}>
                    {w}
                  </motion.span>
                ))}
              </span>
            ))}
          </h1>

          <motion.p initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: B + 0.75, duration: 0.6 }}
            className="mt-6 max-w-xl text-lg leading-relaxed text-muted">
            Synaptogenesis starts with <span className="text-text">zero</span> tools. When a question needs a system,
            it runs <span className="font-mono text-violet">synapse build</span> itself, grafts only the endpoints it
            needs, answers across systems, and prunes the access afterwards.
          </motion.p>
          <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: B + 1.0 }}
            className="mt-4 border-l-2 border-violet/60 pl-4 font-display text-base text-text/90 italic">
            Every other team used Synapse to build an agent. We built an agent that uses Synapse.
          </motion.p>

          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: B + 1.15 }}
            className="mt-10 flex flex-wrap items-center gap-4">
            <Magnetic>
              <Link href="/app" data-cursor="Launch"
                className="group relative inline-flex items-center gap-2 overflow-hidden rounded-full bg-white px-7 py-3.5 font-semibold text-black transition-shadow hover:shadow-[0_0_50px_rgba(196,181,253,.55)]">
                <span className="relative z-10">Launch the app</span>
                <motion.span className="relative z-10 inline-block" animate={{ x: [0, 4, 0] }} transition={{ repeat: Infinity, duration: 1.6 }}>→</motion.span>
              </Link>
            </Magnetic>
            <Magnetic>
              <a href="#preview" data-cursor="Watch" className="glass inline-flex rounded-full px-7 py-3.5 font-medium text-text transition hover:border-violet/50">
                See it run
              </a>
            </Magnetic>
          </motion.div>
        </div>

        <motion.div initial={{ opacity: 0, scale: 0.85 }} animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: B + 0.3, duration: 1.4, ease: [0.22, 1, 0.36, 1] }} className="relative -my-10 lg:-mr-16">
          <HeroCore />
          <p className="pointer-events-none absolute bottom-6 left-1/2 -translate-x-1/2 font-mono text-[10.5px] tracking-[0.2em] text-muted uppercase">
            move · click the core
          </p>
        </motion.div>
      </div>

      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: B + 1.6 }}
        className="absolute bottom-6 left-1/2 -translate-x-1/2 text-xs tracking-[0.25em] text-muted uppercase">
        <motion.div animate={{ y: [0, 6, 0] }} transition={{ repeat: Infinity, duration: 2 }}>scroll</motion.div>
      </motion.div>
    </section>
  );
}

/* A looping, scripted replay of a real run: search → Synapse build → tools grow → answer → prune. */
const SCRIPT: { t: string; c?: string; tools?: number; pause?: number }[] = [
  { t: '› Which customers are hit by the delayed Pune insulin shipment?', c: "text-text", tools: 0, pause: 900 },
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
  const [n, setN] = useState(0);
  const [tools, setTools] = useState(0);
  useEffect(() => {
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
  }, [startAfter]);

  return (
    <div className="glass relative overflow-hidden rounded-2xl shadow-[0_30px_120px_rgba(124,58,237,.25)]">
      <div className="flex items-center justify-between border-b border-line px-4 py-3">
        <div className="flex gap-1.5">{["#ff5f57", "#febc2e", "#28c840"].map((c) => <span key={c} className="h-2.5 w-2.5 rounded-full" style={{ background: c }} />)}</div>
        <span className="font-mono text-[11px] text-muted">synaptogenesis — live graft</span>
        <ToolMeter tools={tools} />
      </div>
      <div className="h-[300px] space-y-1.5 overflow-hidden p-4 font-mono text-[12.5px] leading-relaxed">
        <AnimatePresence initial={false}>
          {SCRIPT.slice(0, n).map((s, i) => (
            <motion.div key={`${i}-${s.t}`} className={`${s.c} whitespace-pre`}
              initial={{ opacity: 0, x: -8, filter: "blur(4px)" }} animate={{ opacity: 1, x: 0, filter: "blur(0px)" }}
              exit={{ opacity: 0 }} transition={{ duration: 0.3 }}>
              {s.t}
            </motion.div>
          ))}
        </AnimatePresence>
        <motion.span className="inline-block h-4 w-2 bg-violet/80 align-middle" animate={{ opacity: [1, 0, 1] }} transition={{ repeat: Infinity, duration: 1 }} />
      </div>
    </div>
  );
}

function ToolMeter({ tools }: { tools: number }) {
  return (
    <div className="flex items-center gap-2 font-mono text-[11px]">
      <span className="text-muted">tools</span>
      <div className="flex gap-0.5">
        {Array.from({ length: 6 }, (_, i) => (
          <motion.span key={i} className="h-3 w-1.5 rounded-sm"
            animate={{ backgroundColor: i < tools ? "#6ef2c0" : "#1b2640", boxShadow: i < tools ? "0 0 8px #6ef2c0" : "0 0 0 transparent" }}
            transition={{ type: "spring", stiffness: 300, damping: 20 }} />
        ))}
      </div>
      <motion.span key={tools} initial={{ y: -6, opacity: 0 }} animate={{ y: 0, opacity: 1 }} className="w-14 text-text">{tools} / 39</motion.span>
    </div>
  );
}
