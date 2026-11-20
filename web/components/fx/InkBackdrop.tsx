"use client";

import { motion, useScroll, useSpring, useTransform } from "motion/react";
import { useRef } from "react";

/* Hand-drawn neurons (Cajal style) that draw themselves as their section scrolls into view, with parallax. */
const NEURONS: Record<string, { d: string[]; soma: [number, number] }> = {
  pyramidal: {
    soma: [300, 330],
    d: [
      "M300 330 C 296 260, 304 190, 300 110 M300 170 C 270 140, 240 120, 205 112 M300 150 C 330 120, 360 104, 398 98 M300 215 C 268 205, 238 200, 214 182",
      "M300 330 C 250 360, 200 380, 140 420 M190 382 C 170 400, 150 430, 150 470 M300 330 C 350 362, 404 380, 470 404 M420 386 C 440 410, 452 438, 450 476",
      "M300 330 C 302 400, 306 470, 304 560 M304 470 C 330 490, 360 500, 390 520 M304 520 C 280 540, 256 560, 230 590",
    ],
  },
  stellate: {
    soma: [300, 300],
    d: [
      "M300 300 C 250 260, 210 220, 150 200 M210 228 C 196 200, 190 172, 196 140 M300 300 C 352 254, 400 222, 460 210 M402 226 C 420 196, 440 176, 470 166",
      "M300 300 C 240 320, 190 350, 130 380 M180 352 C 170 384, 168 414, 180 444 M300 300 C 360 330, 410 360, 470 400 M410 364 C 430 392, 446 420, 450 452",
      "M300 300 C 296 360, 300 420, 290 500 M300 300 C 304 240, 300 180, 310 110",
    ],
  },
};

export function InkBackdrop({ kind = "pyramidal", side = "right", className = "" }: { kind?: keyof typeof NEURONS; side?: "left" | "right"; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start end", "end start"] });
  const draw = useSpring(useTransform(scrollYProgress, [0.05, 0.55], [0, 1]), { stiffness: 80, damping: 22 });
  const y = useTransform(scrollYProgress, [0, 1], [80, -80]);
  const rotate = useTransform(scrollYProgress, [0, 1], [side === "right" ? -6 : 6, side === "right" ? 4 : -4]);
  const n = NEURONS[kind];
  return (
    <div ref={ref} aria-hidden className={`pointer-events-none absolute inset-y-0 ${side === "right" ? "-right-24" : "-left-24"} z-0 hidden w-[620px] md:block ${className}`}>
      <motion.svg viewBox="0 0 600 640" className="sticky top-[10vh] h-[80vh] w-full opacity-[0.16]" style={{ y, rotate }}>
        {n.d.map((d, i) => (
          <motion.path key={i} d={d} fill="none" stroke="#16130f" strokeWidth={i === 0 ? 3.2 : 2.4} strokeLinecap="round"
            style={{ pathLength: draw }} />
        ))}
        <motion.ellipse cx={n.soma[0]} cy={n.soma[1]} rx={20} ry={16} fill="#e8551f" style={{ scale: draw, opacity: draw }} />
      </motion.svg>
    </div>
  );
}

/** Soft colour washes that drift slowly behind a section (keeps the paper from feeling flat). */
export function Wash({ tone = "signal" }: { tone?: "signal" | "cobalt" | "moss" }) {
  const c = { signal: "rgba(232,85,31,.10)", cobalt: "rgba(35,70,216,.08)", moss: "rgba(62,124,79,.09)" }[tone];
  return (
    <motion.div aria-hidden className="pointer-events-none absolute inset-0 z-0 overflow-hidden"
      initial={{ opacity: 0 }} whileInView={{ opacity: 1 }} viewport={{ once: true }} transition={{ duration: 1.2 }}>
      <div className="wash-a absolute -top-32 left-[8%] h-[480px] w-[480px] rounded-full blur-[90px]" style={{ background: c }} />
      <div className="wash-b absolute right-[6%] bottom-0 h-[420px] w-[420px] rounded-full blur-[100px]" style={{ background: c }} />
    </motion.div>
  );
}
