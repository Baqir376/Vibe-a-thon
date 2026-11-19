"use client";

import Link from "next/link";
import { motion, useScroll, useTransform } from "motion/react";
import { useRef } from "react";
import { Magnetic } from "@/components/fx/Interactions";
import { GraftTerminal } from "./Hero";

/** Apple-style product reveal: the app tilts back in 3D, then flattens as you scroll into it. */
export function AppPreview() {
  const ref = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start end", "center center"] });
  const rotateX = useTransform(scrollYProgress, [0, 1], [38, 0]);
  const scale = useTransform(scrollYProgress, [0, 1], [0.82, 1]);
  const y = useTransform(scrollYProgress, [0, 1], [120, 0]);
  const glow = useTransform(scrollYProgress, [0.4, 1], [0, 1]);

  return (
    <section id="preview" className="relative px-5 pt-10 pb-28">
      <div className="mx-auto mb-14 max-w-3xl text-center">
        <p className="mb-3 font-mono text-xs tracking-[0.3em] text-signal uppercase">Plate II · the app</p>
        <h2 className="font-display text-4xl font-semibold tracking-tight text-carbon sm:text-6xl">One question. <i className="text-signal">Four systems.</i><br />Zero pre-wired tools.</h2>
      </div>
      <div ref={ref} style={{ perspective: 1400 }} className="mx-auto max-w-5xl">
        <motion.div style={{ rotateX, scale, y, transformOrigin: "50% 100%" }} className="relative">
          <motion.div style={{ opacity: glow }} className="pointer-events-none absolute -inset-6 rounded-[40px] bg-signal/15 blur-[60px]" />
          <div className="glass relative overflow-hidden rounded-[22px] border-[1.5px] border-carbon shadow-[8px_8px_0_#16130f]">
            <div className="flex items-center gap-2 border-b border-line px-4 py-3">
              {["#ff5f57", "#febc2e", "#28c840"].map((c) => <span key={c} className="h-2.5 w-2.5 rounded-full" style={{ background: c }} />)}
              <span className="mx-auto rounded-md bg-ink/70 px-3 py-0.5 font-mono text-[11px] text-muted">synaptogenesis.app/app</span>
            </div>
            <div className="grid gap-0 md:grid-cols-[1.2fr_1fr]">
              <MiniMap />
              <div className="border-l border-line/60 p-4"><GraftTerminal startAfter={0.2} /></div>
            </div>
          </div>
        </motion.div>
      </div>
      <div className="mt-14 flex justify-center">
        <Magnetic>
          <Link href="/app" data-cursor="Launch" className="inline-flex items-center gap-2 rounded-full bg-carbon px-8 py-4 text-lg font-semibold text-paper shadow-[4px_4px_0_#e8551f]">
            Try it yourself →
          </Link>
        </Magnetic>
      </div>
    </section>
  );
}

const SYS = [[120, 80, "orders"], [380, 80, "inventory"], [380, 280, "tickets"], [120, 280, "roster"]] as const;
const LIVE = [0, 2, 3];

function MiniMap() {
  return (
    <div className="dot-grid relative">
      <svg viewBox="0 0 500 360" className="h-full w-full">
        <defs><filter id="mm"><feGaussianBlur stdDeviation="3" result="b" /><feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge></filter></defs>
        {SYS.map(([x, y], i) => (
          <g key={i}>
            {[0, 1, 2, 3].map((j) => {
              const a = (Math.atan2(y - 180, x - 250) + (j - 1.5) * 0.45);
              return <circle key={j} cx={x + Math.cos(a) * 52} cy={y + Math.sin(a) * 52} r={3.2} fill={LIVE.includes(i) && j === 1 ? "#8fd18a" : "#3a3229"} />;
            })}
            {LIVE.includes(i) && (
              <motion.path d={`M 250 180 Q ${x} ${y} ${x + Math.cos(Math.atan2(y - 180, x - 250) - 0.225) * 52} ${y + Math.sin(Math.atan2(y - 180, x - 250) - 0.225) * 52}`}
                fill="none" stroke="#8fd18a" strokeWidth={2} filter="url(#mm)"
                initial={{ pathLength: 0 }} whileInView={{ pathLength: [0, 1, 1, 0] }} viewport={{ once: false }}
                transition={{ duration: 6, times: [0, 0.2, 0.8, 1], repeat: Infinity, delay: i * 0.15 }} />
            )}
            <circle cx={x} cy={y} r={24} fill="#221d17" stroke="#4a4033" />
            <text x={x} y={y + 4} textAnchor="middle" className="fill-text font-sans text-[10px] font-semibold">{String(SYS[i][2])}</text>
          </g>
        ))}
        <motion.circle cx={250} cy={180} r={42} fill="#e8551f" opacity={0.25} filter="url(#mm)" animate={{ r: [40, 48, 40] }} transition={{ duration: 3, repeat: Infinity }} />
        <circle cx={250} cy={180} r={28} fill="#b8401a" stroke="#ff7a45" />
        <text x={250} y={184} textAnchor="middle" className="fill-text font-sans text-[10px] font-bold">AGENT</text>
      </svg>
    </div>
  );
}
