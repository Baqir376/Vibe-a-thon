"use client";

import { AnimatePresence, motion, useInView, useReducedMotion } from "motion/react";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { Tilt } from "@/components/fx/Interactions";
import { InkBackdrop, Wash } from "@/components/fx/InkBackdrop";

function Card({ className = "", title, kicker, children, delay = 0 }: { className?: string; title: string; kicker: string; children: ReactNode; delay?: number }) {
  const ref = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState({ x: -400, y: -400 });
  return (
    <Tilt className={className} max={6}>
    <motion.div ref={ref}
      initial={{ opacity: 0, y: 40 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, margin: "-80px" }}
      transition={{ duration: 0.7, delay, ease: [0.22, 1, 0.36, 1] }}
      onPointerMove={(e) => { const r = ref.current!.getBoundingClientRect(); setPos({ x: e.clientX - r.left, y: e.clientY - r.top }); }}
      onPointerLeave={() => setPos({ x: -400, y: -400 })}
      className="card-paper group relative h-full overflow-hidden rounded-3xl p-6">
      <div className="pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-300 group-hover:opacity-100"
        style={{ background: `radial-gradient(420px circle at ${pos.x}px ${pos.y}px, rgba(232,85,31,.14), transparent 45%)` }} />
      <p className="font-mono text-[11px] tracking-[0.25em] text-signal-ink uppercase">{kicker}</p>
      <h3 className="mt-2 font-display text-xl font-semibold tracking-tight">{title}</h3>
      <div className="relative mt-5" style={{ transform: "translateZ(30px)" }}>{children}</div>
    </motion.div>
    </Tilt>
  );
}

export function Bento() {
  return (
    <section id="notes" className="relative px-5 py-28">
      <Wash tone="moss" />
      <InkBackdrop kind="pyramidal" side="right" />
      <div className="relative z-10 mx-auto max-w-6xl">
      <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} className="mb-12 max-w-4xl">
        <p className="mb-3 font-mono text-xs tracking-[0.3em] text-signal-ink uppercase">Field notes</p>
        <h2 className="font-display text-4xl font-bold tracking-tight sm:text-5xl">Synapse isn&apos;t a setup step here.<br /><span className="text-graphite">It&apos;s the agent&apos;s nervous system.</span></h2>
      </motion.div>
      <div className="grid gap-4 md:grid-cols-3">
        <Card className="md:col-span-2" kicker="Track 1 + 3" title="Live grafting across legacy systems">
          <GraftBeams />
          <div className="mt-4 flex flex-wrap gap-6 font-mono text-xs text-graphite">
            <span><b className="text-carbon">0</b> tools at rest</span><span><b className="text-carbon">0.4 s</b> local Synapse build</span>
            <span><b className="text-carbon">4 / 39</b> peak tools</span><span><b className="text-carbon">2</b> Synapse modes (local + hosted)</span>
          </div>
        </Card>
        <Card kicker="Live update" title="Drift Sentinel" delay={0.08}><Drift /></Card>
        <Card kicker="Track 2" title="Verified tool fusion" delay={0.1}><Fusion /></Card>
        <Card kicker="Safety" title="Least privilege by construction" delay={0.14}><Approval /></Card>
        <Card kicker="Cost" title="Runs on free models" delay={0.18}><Models /></Card>
        <Card className="md:col-span-3" kicker="Depth" title="12 Synapse CLI bugs found and written up" delay={0.1}><Bugs /></Card>
      </div>
      </div>
    </section>
  );
}

function GraftBeams() {
  const targets = [[520, 40], [560, 95], [540, 150], [470, 175]];
  const reduce = useReducedMotion();
  const [on, setOn] = useState(reduce ? 4 : 0);
  useEffect(() => { if (reduce) return; const t = setInterval(() => setOn((v) => (v + 1) % 6), 900); return () => clearInterval(t); }, [reduce]);
  return (
    <svg viewBox="0 0 640 200" className="h-44 w-full">
      <defs><filter id="bg"><feGaussianBlur stdDeviation="3" result="b" /><feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge></filter></defs>
      {Array.from({ length: 22 }, (_, i) => <circle key={i} cx={300 + (i % 11) * 30} cy={30 + Math.floor(i / 11) * 140} r={3} fill="#cfc4ad" />)}
      {targets.map(([x, y], i) => {
        const live = on > i && on < 5;
        return (
          <g key={i}>
            <motion.path d={`M 70 100 C 250 100, 300 ${y}, ${x} ${y}`} fill="none" strokeWidth={2} filter="url(#bg)"
              animate={{ pathLength: live ? 1 : 0, opacity: live ? 1 : 0 }} stroke="#e8551f" transition={{ duration: 0.6 }} />
            <motion.circle cx={x} cy={y} animate={{ r: live ? 7 : 4, fill: live ? "#e8551f" : "#16130f" }} />
          </g>
        );
      })}
      <circle cx={70} cy={100} r={30} fill="#16130f" stroke="#e8551f" />
      <text x={70} y={104} textAnchor="middle" className="fill-paper font-sans text-[11px] font-bold">AGENT</text>
      <motion.text x={330} y={110} textAnchor="middle" className="fill-violet font-mono text-[12px]"
        animate={{ opacity: on === 0 ? 1 : 0 }}>synapse build --auto …</motion.text>
    </svg>
  );
}

function Drift() {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: false });
  const reduce = useReducedMotion();
  const [phase, setPhase] = useState(reduce ? 3 : 0);
  useEffect(() => {
    if (!inView || reduce) return;
    const t = setInterval(() => setPhase((p) => (p + 1) % 4), 1300);
    return () => clearInterval(t);
  }, [inView, reduce]);
  return (
    <div ref={ref} className="space-y-3">
      <div className="rounded-xl bg-paper-2 p-3 font-mono text-[11.5px]">
        <span className="text-graphite">@app.get(</span>
        <motion.span animate={{ color: phase >= 1 ? "#c99a06" : "#a39887" }}>&quot;/shipments/{"{id}"}/eta&quot;</motion.span>
        <span className="text-graphite">)</span>
      </div>
      <div className="flex items-center gap-3 text-xs text-graphite">
        <motion.span animate={{ opacity: phase >= 2 ? 1 : 0.3 }} className="font-mono">◎ synapse build --discover</motion.span>
      </div>
      <div className="flex items-center gap-3">
        <motion.span className="h-4 w-4 rounded-full bg-ochre" animate={{ scale: phase >= 3 ? [0, 1.4, 1] : 0, boxShadow: "0 0 16px #c99a06" }} />
        <AnimatePresence>{phase >= 3 && (
          <motion.span initial={{ opacity: 0, x: -6 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0 }} className="text-sm">
            In the atlas in <b>3.3 s</b>, used on the next question
          </motion.span>)}</AnimatePresence>
      </div>
    </div>
  );
}

function Fusion() {
  const reduce = useReducedMotion();
  const [merged, setMerged] = useState(!!reduce);
  useEffect(() => { if (reduce) return; const t = setInterval(() => setMerged((m) => !m), 2200); return () => clearInterval(t); }, [reduce]);
  const checks = ["replayed call succeeds", "identical call refused", "first Synapse draft rejected"];
  return (
    <div>
      <div className="flex h-16 items-center justify-center gap-3">
        {["get_ticket", "check_policy", "create_refund"].map((t, i) => (
          <motion.span key={t} layout animate={{ x: merged ? (1 - i) * 92 : 0, opacity: merged ? 0 : 1, scale: merged ? 0.6 : 1 }}
            transition={{ type: "spring", stiffness: 140, damping: 18 }}
            className="rounded-md border border-rule bg-paper-2 px-2 py-1 font-mono text-[10.5px] text-graphite">{t}</motion.span>
        ))}
        <AnimatePresence>{merged && (
          <motion.span initial={{ scale: 0 }} animate={{ scale: 1 }} exit={{ scale: 0 }} transition={{ type: "spring", stiffness: 300, damping: 16 }}
            className="absolute rounded-md bg-signal-deep px-3 py-1.5 font-mono text-xs font-semibold text-white shadow-[0_0_30px_rgba(232,85,31,.6)]">process_refund</motion.span>)}
        </AnimatePresence>
      </div>
      <ul className="mt-3 space-y-1.5 text-[13px]">
        {checks.map((c, i) => (
          <motion.li key={c} initial={{ opacity: 0, x: -6 }} whileInView={{ opacity: 1, x: 0 }} transition={{ delay: 0.3 + i * 0.25 }} className="flex gap-2 text-graphite">
            <span className={i === 2 ? "text-signal-deep" : "text-moss"}>{i === 2 ? "✖" : "✓"}</span>{c}
          </motion.li>
        ))}
      </ul>
    </div>
  );
}

function Approval() {
  return (
    <motion.div animate={{ boxShadow: ["0 0 0 rgba(176,125,18,0)", "0 0 30px rgba(176,125,18,.25)", "0 0 0 rgba(176,125,18,0)"] }}
      transition={{ duration: 2.6, repeat: Infinity }} className="rounded-2xl border border-ochre bg-paper-2 p-4">
      <p className="text-sm font-semibold text-ochre">Allow this action?</p>
      <p className="mt-1 font-mono text-[11.5px] text-graphite">tickets · POST /refunds · ₹8,847.50</p>
      <div className="mt-3 flex justify-end gap-2 text-xs">
        <span className="rounded-lg border border-rule px-3 py-1.5 text-graphite">Decline</span>
        <motion.span whileHover={{ scale: 1.05 }} className="rounded-lg bg-ochre px-3 py-1.5 font-semibold text-[#2a1800]">Approve</motion.span>
      </div>
      <p className="mt-3 text-xs text-graphite">Every write: approved at graft time <i>and</i> at call time. Policy can forbid endpoints outright.</p>
    </motion.div>
  );
}

function Models() {
  const models = ["groq · gpt-oss-120b", "groq · qwen3.8-27b", "openrouter · nemotron-3-ultra", "groq · gpt-oss-20b"];
  const reduce = useReducedMotion();
  const [i, setI] = useState(0);
  useEffect(() => { if (reduce) return; const t = setInterval(() => setI((v) => (v + 1) % models.length), 1600); return () => clearInterval(t); }, [models.length, reduce]);
  return (
    <div>
      <div className="relative h-10 overflow-hidden">
        <AnimatePresence mode="popLayout">
          <motion.div key={i} initial={{ y: 30, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: -30, opacity: 0 }}
            className="absolute inline-flex rounded-full border border-moss bg-moss/10 px-3 py-1.5 font-mono text-xs text-moss">{models[i]}</motion.div>
        </AnimatePresence>
      </div>
      <p className="mt-3 text-sm text-graphite">On a rate limit it switches models instantly instead of waiting; rejected tool calls are fed back for a retry instead of crashing the run.</p>
    </div>
  );
}

function Bugs() {
  const bugs = [
    ["Body fields silently dropped", "Literal[...] types and trailing # comments vanish from generated tools: a required refund field disappeared."],
    ["Hosted Express params broken", "':id' paths never templated, POST bodies empty, so we moved those services to FastAPI."],
    ["Custom mode eats its own output", "Composes new tools on top of earlier generated files; we park them before every fusion."],
  ];
  return (
    <div className="grid gap-3 md:grid-cols-3">
      {bugs.map(([t, d], i) => (
        <motion.div key={t} initial={{ opacity: 0, y: 14 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: i * 0.1 }}
          className="rounded-2xl border border-rule bg-paper-2 p-4">
          <p className="font-mono text-[11px] text-signal-deep">#{[10, 2, 11][i]}</p>
          <p className="mt-1 font-semibold">{t}</p>
          <p className="mt-1 text-[13px] leading-relaxed text-graphite">{d}</p>
        </motion.div>
      ))}
    </div>
  );
}
