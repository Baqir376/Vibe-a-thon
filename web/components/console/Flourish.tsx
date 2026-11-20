"use client";

import { AnimatePresence, motion } from "motion/react";

/** Hand-written margin notes (the landing page's notebook voice, in chalk). */
export function MapNote({ show }: { show: boolean }) {
  return (
    <AnimatePresence>
      {show && (
        <motion.div aria-hidden className="pointer-events-none absolute top-[18%] left-[8%] z-10 hidden md:block"
          initial={{ opacity: 0, y: 10, rotate: -6 }} animate={{ opacity: 1, y: 0, rotate: -4 }} exit={{ opacity: 0, y: -10 }}
          transition={{ delay: 1.2, duration: 0.6 }}>
          <p className="font-hand text-[26px] leading-tight text-[#f1eadc]/75">
            zero tools, for now.<br />ask it something and<br /><span className="text-[#ff9a6e]">watch it grow its own.</span>
          </p>
          <svg width="420" height="160" viewBox="0 0 420 160" className="mt-1 ml-24 overflow-visible">
            <motion.path d="M4 6 C 110 6, 300 30, 392 140" fill="none" stroke="#ff9a6e" strokeWidth={2} strokeLinecap="round"
              initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ delay: 1.8, duration: 0.9 }} />
            <motion.path d="M374 134 L 393 142 L 394 121" fill="none" stroke="#ff9a6e" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"
              initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ delay: 2.6, duration: 0.3 }} />
          </svg>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

export function StartHere({ show }: { show: boolean }) {
  return (
    <AnimatePresence>
      {show && (
        <motion.span aria-hidden className="pointer-events-none absolute -top-1 right-2 font-hand text-[19px] text-[#ff9a6e]"
          initial={{ opacity: 0, rotate: 0 }} animate={{ opacity: 1, rotate: -5, y: [0, -3, 0] }} exit={{ opacity: 0 }}
          transition={{ opacity: { delay: 1.5 }, y: { duration: 2.4, repeat: Infinity } }}>
          start here ↓
        </motion.span>
      )}
    </AnimatePresence>
  );
}

/** A rubber stamp that thumps onto the map when a run finishes. */
export function DoneStamp({ show, tools, peak }: { show: boolean; tools: number; peak: number }) {
  return (
    <AnimatePresence>
      {show && (
        <motion.div aria-hidden className="pointer-events-none absolute top-6 right-6 z-10"
          initial={{ opacity: 0, scale: 2.2, rotate: -18 }} animate={{ opacity: 1, scale: 1, rotate: -8 }} exit={{ opacity: 0, scale: 0.9 }}
          transition={{ type: "spring", stiffness: 420, damping: 18 }}>
          <div className="stamp rounded-md border-[2.5px] border-[#8fd18a] px-4 py-2 text-[#8fd18a] shadow-[0_0_30px_rgba(143,209,138,.25)]">
            <p className="text-[15px] font-bold">Answered</p>
            <p className="text-[10px] opacity-80">peak {peak} tools · now {tools}</p>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
