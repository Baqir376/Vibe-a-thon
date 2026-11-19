"use client";

import { AnimatePresence, motion, useMotionValueEvent, useScroll } from "motion/react";
import { useRef, useState } from "react";

const STEPS = [
  { k: "01", title: "Find", cmd: "find_capability([...])",
    body: "The agent starts with zero business tools. It searches the Capability Atlas: every endpoint of every legacy system, indexed from Synapse's own code scan." },
  { k: "02", title: "Graft", cmd: 'synapse build --auto --endpoints "…"',
    body: "Synapse builds an MCP server for exactly the endpoints that answer the question, live, in about 0.4 s. Writes need a human to approve." },
  { k: "03", title: "Use", cmd: "6 parallel calls · 3 systems",
    body: "The new tools appear on the agent's next step. It joins facts across systems by shared ids and cites every one." },
  { k: "04", title: "Prune", cmd: "tools: 4 → 0",
    body: "Access is dropped the moment the task ends. Connections go dormant and reactivate in milliseconds next time." },
];

export function HowItWorks() {
  const ref = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start start", "end end"] });
  const [step, setStep] = useState(0);
  useMotionValueEvent(scrollYProgress, "change", (v) => setStep(Math.min(3, Math.floor(v * 4))));

  return (
    <section id="how" ref={ref} className="relative h-[340vh]">
      <div className="sticky top-0 flex h-screen items-center overflow-hidden">
        <div className="mx-auto grid w-full max-w-6xl items-center gap-12 px-5 lg:grid-cols-2">
          <div>
            <p className="mb-3 font-mono text-xs tracking-[0.3em] text-signal-ink uppercase">How it works</p>
            <h2 className="font-display text-4xl font-bold tracking-tight sm:text-5xl">Just-in-time tools,<br /><span className="text-graphite">not pre-wired ones.</span></h2>
            <div className="relative mt-10 space-y-2">
              <div className="absolute top-2 bottom-2 left-[19px] w-px bg-line" />
              <motion.div className="absolute top-2 left-[19px] w-px origin-top bg-gradient-to-b from-violet to-live"
                style={{ height: "calc(100% - 16px)", scaleY: scrollYProgress }} />
              {STEPS.map((s, i) => (
                <div key={s.k} className={`relative flex gap-5 py-3 transition-colors duration-300 ${i === step ? "text-carbon" : "text-graphite"}`}>
                  <motion.div animate={{ backgroundColor: i <= step ? "#b8401a" : "#ebe4d5", borderColor: i <= step ? "#b8401a" : "#d6ccb8", scale: i === step ? 1.08 : 1 }}
                    className="z-10 flex h-10 w-10 shrink-0 items-center justify-center rounded-full border font-mono text-xs font-semibold"
                    style={{ color: i <= step ? "#ffffff" : "#5f574c" }}>{s.k}</motion.div>
                  <div>
                    <div className="flex flex-wrap items-baseline gap-3">
                      <h3 className="font-display text-xl font-semibold">{s.title}</h3>
                      <code className="rounded bg-paper-2 px-1.5 py-0.5 font-mono text-[11px] text-signal-ink">{s.cmd}</code>
                    </div>
                    <AnimatePresence initial={false}>
                      {i === step && (
                        <motion.p initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }}
                          className="mt-2 max-w-md overflow-hidden text-[15px] leading-relaxed text-graphite">{s.body}</motion.p>
                      )}
                    </AnimatePresence>
                  </div>
                </div>
              ))}
            </div>
          </div>
          <StepVisual step={step} />
        </div>
      </div>
    </section>
  );
}

// Mini neural map: agent on the left, three systems with endpoints on the right.
const AGENT = { x: 90, y: 210 };
const SYS = [
  { name: "orders", x: 330, y: 90, eps: [[430, 40], [450, 90], [430, 140]] },
  { name: "tickets", x: 330, y: 210, eps: [[440, 175], [455, 215], [440, 255]] },
  { name: "roster", x: 330, y: 330, eps: [[430, 285], [450, 330], [430, 375]] },
];
const PICKED = [[0, 0], [0, 1], [1, 1], [2, 1]] as const; // endpoints the question needs

function curve(ax: number, ay: number, sx: number, sy: number, ex: number, ey: number) {
  return `M ${ax} ${ay} Q ${sx} ${sy} ${ex} ${ey}`;
}

function StepVisual({ step }: { step: number }) {
  const live = step === 1 || step === 2;
  return (
    <div className="card-paper relative aspect-[5/4] overflow-hidden rounded-3xl">
      <div className="graph-paper absolute inset-0 opacity-60" />
      <svg viewBox="0 0 520 420" className="relative h-full w-full">
        {SYS.map((s) => (
          <g key={s.name}>
            <line x1={AGENT.x} y1={AGENT.y} x2={s.x} y2={s.y} stroke="#d6ccb8" strokeDasharray="3 6" />
            {s.eps.map(([x, y], j) => (
              <line key={j} x1={s.x} y1={s.y} x2={x} y2={y} stroke="#cfc4ad" />
            ))}
          </g>
        ))}
        {/* step 1: search sweep */}
        <AnimatePresence>
          {step === 0 && (
            <motion.rect key="sweep" x={300} width={190} height={60} rx={10} fill="url(#sweep)"
              initial={{ y: 10, opacity: 0 }} animate={{ y: [10, 350, 10], opacity: 1 }} exit={{ opacity: 0 }}
              transition={{ y: { duration: 2.4, repeat: Infinity, ease: "easeInOut" } }} />
          )}
        </AnimatePresence>
        <defs>
          <linearGradient id="sweep" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#2346d8" stopOpacity="0" /><stop offset=".5" stopColor="#2346d8" stopOpacity=".18" /><stop offset="1" stopColor="#2346d8" stopOpacity="0" />
          </linearGradient>
          <filter id="glow2"><feGaussianBlur stdDeviation="3" result="b" /><feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge></filter>
        </defs>
        {/* grafted links */}
        {PICKED.map(([si, ei], k) => {
          const s = SYS[si], [ex, ey] = s.eps[ei];
          const d = curve(AGENT.x, AGENT.y, s.x, s.y, ex, ey);
          return (
            <g key={k}>
              {/* solid stroke draws itself in (pathLength owns the dasharray) */}
              <motion.path d={d} fill="none" strokeWidth={2.2} filter="url(#glow2)"
                animate={{ pathLength: step >= 1 ? 1 : 0, stroke: step === 3 ? "#a39887" : "#e8551f", opacity: step >= 1 ? (step === 3 ? 0.35 : 0.9) : 0 }}
                transition={{ duration: 0.8, delay: step === 1 ? k * 0.18 : 0 }} />
              {/* separate dashed overlay carries the flowing-signal effect */}
              <motion.path d={d} fill="none" strokeWidth={step === 3 ? 1.4 : 2.4} strokeDasharray={step === 3 ? "3 6" : "6 10"}
                className={live ? "link-flow" : ""} animate={{ opacity: step >= 1 ? 1 : 0, stroke: step === 3 ? "#a39887" : "#ffffff" }}
                transition={{ duration: 0.4, delay: step === 1 ? 0.6 + k * 0.18 : 0 }} />
              {step === 2 && (
                <motion.circle r={4.5} fill="#fff" filter="url(#glow2)"
                  style={{ offsetPath: `path("${d}")` }}
                  initial={{ offsetDistance: "0%" }} animate={{ offsetDistance: ["0%", "100%", "0%"] }}
                  transition={{ duration: 1.4, repeat: Infinity, delay: k * 0.25, ease: "easeInOut" }} />
              )}
            </g>
          );
        })}
        {/* endpoints */}
        {SYS.map((s, si) => s.eps.map(([x, y], j) => {
          const picked = PICKED.some(([a, b]) => a === si && b === j);
          const on = picked && step >= 1 && step <= 2;
          return (
            <motion.circle key={`${si}-${j}`} cx={x} cy={y}
              animate={{ r: on ? 7 : 5, fill: on ? "#e8551f" : picked && step === 0 ? "#2346d8" : picked && step === 3 ? "rgba(0,0,0,0)" : "#cfc4ad",
                         stroke: picked && step === 3 ? "#a39887" : "rgba(0,0,0,0)" }}
              strokeWidth={1.6} transition={{ type: "spring", stiffness: 260, damping: 18 }} />
          );
        }))}
        {/* systems */}
        {SYS.map((s) => (
          <g key={s.name}>
            <motion.circle cx={s.x} cy={s.y} r={26} fill="#f8f4ec" stroke="#16130f"
              animate={step === 1 ? { stroke: ["#16130f", "#e8551f", "#16130f"] } : {}} transition={{ duration: 1, repeat: step === 1 ? Infinity : 0 }} />
            <text x={s.x} y={s.y + 4} textAnchor="middle" className="fill-carbon font-sans text-[11px] font-semibold">{s.name}</text>
          </g>
        ))}
        {/* agent */}
        <motion.circle cx={AGENT.x} cy={AGENT.y} r={46} fill="#e8551f" opacity={0.25} animate={{ r: [44, 52, 44] }} transition={{ duration: 3, repeat: Infinity }} filter="url(#glow2)" />
        <circle cx={AGENT.x} cy={AGENT.y} r={32} fill="#16130f" stroke="#e8551f" />
        <text x={AGENT.x} y={AGENT.y - 2} textAnchor="middle" className="fill-paper font-sans text-[11px] font-bold">AGENT</text>
        <motion.text key={step} x={AGENT.x} y={AGENT.y + 13} textAnchor="middle" className="fill-[#f3eee3] font-mono text-[10px]"
          initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
          {step === 0 ? "0 tools" : step === 3 ? "0 tools" : "4 tools"}
        </motion.text>
        <AnimatePresence>
          {step === 1 && (
            <motion.text key="build" x={330} y={20} textAnchor="middle" className="fill-violet font-mono text-[11px]"
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>synapse build · 0.4 s</motion.text>
          )}
        </AnimatePresence>
      </svg>
    </div>
  );
}
