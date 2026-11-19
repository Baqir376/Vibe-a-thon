"use client";

import { motion } from "motion/react";

/** A synapse: one soma and three dendrites, one of them reaching to a new node. */
export function LogoMark({ size = 28, animate = false }: { size?: number; animate?: boolean }) {
  const draw = animate
    ? { initial: { pathLength: 0, opacity: 0 }, animate: { pathLength: 1, opacity: 1 } }
    : { initial: false as const };
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none" aria-hidden>
      <defs>
        <linearGradient id="lg" x1="0" y1="0" x2="32" y2="32">
          <stop offset="0%" stopColor="#ffb089" />
          <stop offset="100%" stopColor="#8fd18a" />
        </linearGradient>
      </defs>
      {["M16 16 L6 7", "M16 16 L5 23", "M16 16 L27 9", "M16 16 L26 24"].map((d, i) => (
        <motion.path key={d} d={d} stroke="url(#lg)" strokeWidth={1.8} strokeLinecap="round"
          {...draw} transition={{ duration: 0.5, delay: 0.15 * i, ease: "easeOut" }} />
      ))}
      {[[6, 7], [5, 23], [27, 9]].map(([x, y], i) => (
        <motion.circle key={i} cx={x} cy={y} r={2.2} fill="#ff7a45"
          initial={animate ? { scale: 0 } : false} animate={{ scale: 1 }} transition={{ delay: 0.2 + 0.15 * i, type: "spring" }} />
      ))}
      <motion.circle cx={26} cy={24} r={2.6} fill="#8fd18a"
        initial={animate ? { scale: 0 } : false} animate={{ scale: [1, 1.35, 1] }}
        transition={{ duration: 1.8, repeat: Infinity, delay: animate ? 0.9 : 0 }} />
      <circle cx={16} cy={16} r={4.2} fill="url(#lg)" />
    </svg>
  );
}

export function Wordmark({ className = "" }: { className?: string }) {
  return (
    <span className={`font-display font-bold tracking-tight ${className}`}>
      Synapto<span className="text-violet">genesis</span>
    </span>
  );
}

/** The notebook mark: a neuron in ink with an orange soma. */
export function InkMark({ size = 26 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none" aria-hidden>
      <path d="M16 16 C 12 12, 9 9, 5 6 M10 10.5 C 8 10, 6 11, 4 10.5 M16 16 C 19 11, 22 8, 27 5 M16 16 C 21 17, 25 18, 29 16 M16 16 C 15 21, 17 25, 21 29 M16 16 C 12 19, 8 20, 4 23"
        stroke="currentColor" strokeWidth={1.7} strokeLinecap="round" />
      <ellipse cx={16} cy={16} rx={4.2} ry={3.6} fill="#e8551f" />
    </svg>
  );
}
