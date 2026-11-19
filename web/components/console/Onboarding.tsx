"use client";

import { AnimatePresence, motion } from "motion/react";
import { useState } from "react";

const STEPS = [
  { n: "1", title: "Ask a question", body: "Pick a scenario or type anything about Meridian's orders, stock, tickets or staff. The agent starts with zero tools.", color: "#a78bfa" },
  { n: "2", title: "Watch Synapse grow tools", body: "The map lights up as Synapse builds connections to just the endpoints needed. White pulses are tool calls. Then everything is pruned.", color: "#6ef2c0" },
  { n: "3", title: "Approve anything that changes data", body: "Refunds, pages, orders: a card asks you first. Purple nodes are workflows Synapse fused and verified; gold ones were just discovered.", color: "#ffb547" },
];

export function Onboarding({ open, onClose, onDemo }: { open: boolean; onClose: () => void; onDemo: () => void }) {
  const [i, setI] = useState(0);
  const last = i === STEPS.length - 1;
  return (
    <AnimatePresence>
      {open && (
        <motion.div className="fixed inset-0 z-[60] flex items-center justify-center bg-[#03050b]/75 p-4 backdrop-blur-md"
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
          <motion.div initial={{ y: 40, scale: 0.94, opacity: 0 }} animate={{ y: 0, scale: 1, opacity: 1 }} exit={{ y: 20, opacity: 0 }}
            transition={{ type: "spring", stiffness: 260, damping: 24 }}
            className="glass w-[540px] max-w-full overflow-hidden rounded-[28px] shadow-[0_40px_140px_rgba(0,0,0,.6)]">
            <div className="relative h-44 overflow-hidden bg-[radial-gradient(ellipse_at_center,rgba(124,58,237,.35),transparent_70%)]">
              <Illustration step={i} />
            </div>
            <div className="p-7">
              <div className="mb-5 flex gap-1.5">
                {STEPS.map((s, k) => (
                  <motion.span key={s.n} className="h-1 flex-1 rounded-full" animate={{ backgroundColor: k <= i ? s.color : "#1b2640" }} />
                ))}
              </div>
              <AnimatePresence mode="wait">
                <motion.div key={i} initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} transition={{ duration: 0.25 }}>
                  <p className="font-mono text-xs tracking-[0.25em] uppercase" style={{ color: STEPS[i].color }}>Step {STEPS[i].n} of 3</p>
                  <h2 className="mt-2 font-display text-2xl font-semibold tracking-tight">{STEPS[i].title}</h2>
                  <p className="mt-2 leading-relaxed text-muted">{STEPS[i].body}</p>
                </motion.div>
              </AnimatePresence>
              <div className="mt-7 flex items-center gap-3">
                <button onClick={onClose} className="text-sm text-muted transition hover:text-text">Skip</button>
                <div className="ml-auto flex gap-2">
                  {i > 0 && <button onClick={() => setI(i - 1)} className="rounded-full border border-line px-4 py-2 text-sm text-muted hover:text-text">Back</button>}
                  {!last && <button onClick={() => setI(i + 1)} className="rounded-full bg-white px-5 py-2 text-sm font-semibold text-black">Next</button>}
                  {last && (
                    <button onClick={() => { onClose(); onDemo(); }} data-cursor="Go"
                      className="rounded-full bg-white px-5 py-2 text-sm font-semibold text-black shadow-[0_0_40px_rgba(196,181,253,.5)]">
                      Show me a run →
                    </button>
                  )}
                </div>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function Illustration({ step }: { step: number }) {
  const nodes = [[120, 50], [440, 50], [440, 130], [120, 130]];
  return (
    <svg viewBox="0 0 560 176" className="h-full w-full">
      {nodes.map(([x, y], k) => {
        const on = step >= 1 && k !== 1;
        return (
          <g key={k}>
            <motion.path d={`M 280 88 Q ${(280 + x) / 2} ${y} ${x} ${y}`} fill="none" stroke={k === 2 && step === 2 ? "#ffb547" : "#6ef2c0"} strokeWidth={2}
              animate={{ pathLength: on ? 1 : 0, opacity: on ? 1 : 0 }} transition={{ duration: 0.7, delay: k * 0.12 }} />
            <motion.circle cx={x} cy={y} animate={{ r: on ? 9 : 6, fill: on ? (k === 2 && step === 2 ? "#ffb547" : "#6ef2c0") : "#26365a" }} />
          </g>
        );
      })}
      {step === 0 && (
        <motion.text x={280} y={160} textAnchor="middle" className="font-mono text-[12px]" fill="#c4b5fd" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
          “Which customers are hit by the delay?”
        </motion.text>
      )}
      <motion.circle cx={280} cy={88} r={30} fill="#5b21b6" stroke="#a78bfa" animate={{ scale: [1, 1.06, 1] }} transition={{ repeat: Infinity, duration: 2 }} style={{ transformOrigin: "280px 88px" }} />
      <text x={280} y={92} textAnchor="middle" className="fill-white font-sans text-[11px] font-bold">AGENT</text>
    </svg>
  );
}
