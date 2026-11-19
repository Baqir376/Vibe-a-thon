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
          <stop offset="0%" stopColor="#c4b5fd" />
          <stop offset="100%" stopColor="#6ef2c0" />
        </linearGradient>
      </defs>
      {["M16 16 L6 7", "M16 16 L5 23", "M16 16 L27 9", "M16 16 L26 24"].map((d, i) => (
        <motion.path key={d} d={d} stroke="url(#lg)" strokeWidth={1.8} strokeLinecap="round"
          {...draw} transition={{ duration: 0.5, delay: 0.15 * i, ease: "easeOut" }} />
      ))}
      {[[6, 7], [5, 23], [27, 9]].map(([x, y], i) => (
        <motion.circle key={i} cx={x} cy={y} r={2.2} fill="#a78bfa"
          initial={animate ? { scale: 0 } : false} animate={{ scale: 1 }} transition={{ delay: 0.2 + 0.15 * i, type: "spring" }} />
      ))}
      <motion.circle cx={26} cy={24} r={2.6} fill="#6ef2c0"
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
