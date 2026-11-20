"use client";

import Link from "next/link";
import { animate, motion, useInView } from "motion/react";
import { useEffect, useRef, useState } from "react";
import { Magnetic } from "@/components/fx/Interactions";
import { InkBackdrop, Wash } from "@/components/fx/InkBackdrop";

function Count({ to, decimals = 0, suffix = "" }: { to: number; decimals?: number; suffix?: string }) {
  const ref = useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: true });
  const [v, setV] = useState(0);
  useEffect(() => {
    if (!inView) return;
    const c = animate(0, to, { duration: 1.4, ease: [0.22, 1, 0.36, 1], onUpdate: setV });
    return () => c.stop();
  }, [inView, to]);
  return <span ref={ref}>{v.toFixed(decimals)}{suffix}</span>;
}

const STATS = [
  { v: 0.4, d: 1, s: " s", label: "Synapse build per local graft" },
  { v: 3.3, d: 1, s: " s", label: "code change → usable by the agent" },
  { v: 15, d: 0, s: " s", label: "3-system question on free models" },
  { v: 5.6, d: 1, s: "×", label: "less tool schema per request" },
];

const BENCH = [
  { label: "Tools visible to the model", a: 38, b: 4, fmt: (n: number) => `${n}` },
  { label: "Tool schema per request (chars)", a: 11879, b: 2125, fmt: (n: number) => n.toLocaleString() },
  { label: "Answer accuracy", a: 100, b: 97, fmt: (n: number) => `${n}%` },
];

export function Proof() {
  return (
    <section id="proof" className="relative px-5 py-28">
      <Wash tone="signal" />
      <InkBackdrop kind="stellate" side="right" />
      <div className="relative z-10 mx-auto max-w-6xl">
      <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} className="mb-12 max-w-4xl">
        <p className="mb-3 font-mono text-xs tracking-[0.3em] text-signal-ink uppercase">Proof, measured</p>
        <h2 className="font-display text-4xl font-bold tracking-tight sm:text-5xl">Numbers from real runs,<br /><span className="text-graphite">including the unflattering ones.</span></h2>
      </motion.div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {STATS.map((s, i) => (
          <motion.div key={s.label} initial={{ opacity: 0, y: 24 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: i * 0.08 }}
            className="card-paper rounded-3xl p-6">
            <p className="font-display text-5xl font-bold tracking-tight text-gradient"><Count to={s.v} decimals={s.d} suffix={s.s} /></p>
            <p className="mt-2 text-sm text-graphite">{s.label}</p>
          </motion.div>
        ))}
      </div>

      <div className="card-paper mt-4 rounded-3xl p-6 sm:p-8">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <h3 className="font-display text-xl font-semibold">Benchmark: every tool pre-loaded vs. just-in-time</h3>
          <div className="flex gap-4 text-xs text-graphite">
            <span className="flex items-center gap-2"><i className="h-2.5 w-2.5 rounded-sm bg-[#a39887]" />all 38 tools pre-loaded</span>
            <span className="flex items-center gap-2"><i className="h-2.5 w-2.5 rounded-sm bg-signal" />Synaptogenesis</span>
          </div>
        </div>
        <div className="mt-7 space-y-6">
          {BENCH.map((r, i) => {
            const max = Math.max(r.a, r.b);
            return (
              <div key={r.label}>
                <p className="mb-2 text-sm text-graphite">{r.label}</p>
                {[{ v: r.a, c: "#a39887" }, { v: r.b, c: "#e8551f" }].map((bar, j) => (
                  <div key={j} className="mb-1.5 flex items-center gap-3">
                    <div className="h-3 flex-1 overflow-hidden rounded-full bg-ink">
                      <motion.div className="h-full rounded-full" style={{ background: bar.c }}
                        initial={{ width: 0 }} whileInView={{ width: `${(bar.v / max) * 100}%` }} viewport={{ once: true }}
                        transition={{ duration: 1.1, delay: i * 0.12 + j * 0.1, ease: [0.22, 1, 0.36, 1] }} />
                    </div>
                    <span className="w-16 text-right font-mono text-xs">{r.fmt(bar.v)}</span>
                  </div>
                ))}
              </div>
            );
          })}
        </div>
        <p className="mt-6 max-w-3xl text-sm leading-relaxed text-graphite">
          6 questions, free Groq models. At 38 endpoints both setups answer correctly (one JIT miss), and the extra
          discovery turns cancel the smaller prompts, so total tokens are even. The case for just-in-time is
          least privilege, live updates and verified fusion today, and scale tomorrow: hundreds of endpoints do not
          fit in a free-tier request at all. Full table in <code className="font-mono text-signal-ink">docs/benchmark.md</code>.
        </p>
      </div>
      </div>
    </section>
  );
}

export function FinalCTA() {
  return (
    <section className="relative overflow-hidden px-5 pt-16 pb-28">
      <div className="pointer-events-none absolute left-1/2 top-1/2 h-[420px] w-[760px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-signal/10 blur-[130px]" />
      <motion.div initial={{ opacity: 0, scale: 0.96 }} whileInView={{ opacity: 1, scale: 1 }} viewport={{ once: true }} transition={{ duration: 0.8 }}
        className="relative mx-auto max-w-3xl text-center">
        <h2 className="font-display text-5xl font-extrabold tracking-tight sm:text-6xl">Watch it <span className="text-gradient">grow.</span></h2>
        <p className="mx-auto mt-5 max-w-xl text-lg text-carbon/85">Ask a question that spans four legacy systems. Watch Synapse build the connections, the agent use them, and the access disappear.</p>
        <div className="mt-9"><Magnetic>
          <Link href="/app" data-cursor="Launch" className="inline-flex items-center gap-2 rounded-full bg-carbon px-9 py-4 text-lg font-semibold text-paper shadow-[4px_4px_0_#e8551f]">
            Launch the app →
          </Link>
        </Magnetic></div>
      </motion.div>
      <footer className="relative mx-auto mt-28 flex max-w-6xl flex-wrap items-center justify-between gap-4 border-t border-rule pt-6 text-xs text-graphite">
        <span>Synaptogenesis · Vibe-a-thon 2026 · 2nd Brain Labs × Geek Room</span>
        <span className="font-mono">Synapse CLI 0.1.9 · MCP · FastAPI · Next.js · Motion</span>
      </footer>
    </section>
  );
}
