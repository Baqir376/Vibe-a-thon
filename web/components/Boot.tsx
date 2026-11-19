"use client";

import { AnimatePresence, motion } from "motion/react";
import { useEffect, useState } from "react";

// Nine neurons scatter, wire up, then collapse into the mark while the name resolves.
const NODES = [
  [-180, -90], [-60, -140], [90, -120], [190, -40], [150, 90], [20, 140], [-120, 110], [-200, 20], [0, 0],
] as const;
const EDGES = [[0, 8], [1, 8], [2, 8], [3, 8], [4, 8], [5, 8], [6, 8], [7, 8], [0, 1], [2, 3], [4, 5], [6, 7]];
const NAME = "Synaptogenesis";

export function Boot() {
  const [show, setShow] = useState(true);
  const [skip, setSkip] = useState(false);

  useEffect(() => {
    let seen = false;
    try { seen = sessionStorage.getItem("synapto-boot") === "1"; } catch { /* private mode */ }
    // Read after hydration on purpose: reading sessionStorage during render would mismatch the server HTML.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (seen || skip) { setShow(false); return; }
    const t = setTimeout(() => {
      setShow(false);
      try { sessionStorage.setItem("synapto-boot", "1"); } catch { /* ignore */ }
    }, 2600);
    return () => clearTimeout(t);
  }, [skip]);

  return (
    <AnimatePresence>
      {show && (
        <motion.div
          key="boot"
          className="fixed inset-0 z-[100] flex flex-col items-center justify-center bg-ink"
          exit={{ clipPath: "inset(0 0 100% 0)", transition: { duration: 0.8, ease: [0.76, 0, 0.24, 1] } }}
          onClick={() => setSkip(true)}
          style={{ clipPath: "inset(0 0 0% 0)" }}
        >
          <svg width="460" height="320" viewBox="-230 -160 460 320" className="max-w-[90vw]">
            {EDGES.map(([a, b], i) => (
              <motion.line key={i}
                x1={NODES[a][0]} y1={NODES[a][1]} x2={NODES[b][0]} y2={NODES[b][1]}
                stroke={b === 8 ? "#a78bfa" : "#2b3d63"} strokeWidth={b === 8 ? 1.4 : 1}
                initial={{ pathLength: 0, opacity: 0 }}
                animate={{ pathLength: [0, 1, 1], opacity: [0, 0.9, 0] }}
                transition={{ duration: 1.9, times: [0, 0.45, 1], delay: 0.25 + i * 0.05, ease: "easeInOut" }}
              />
            ))}
            {NODES.map(([x, y], i) => (
              <motion.circle key={i} r={i === 8 ? 9 : 4} fill={i === 8 ? "#a78bfa" : "#38d6f5"}
                initial={{ cx: x * 1.6, cy: y * 1.6, opacity: 0, scale: 0 }}
                animate={{ cx: [x * 1.6, x, i === 8 ? 0 : x * 0.12], cy: [y * 1.6, y, i === 8 ? 0 : y * 0.12],
                           opacity: [0, 1, i === 8 ? 1 : 0], scale: [0, 1, i === 8 ? 1.6 : 0.4] }}
                transition={{ duration: 1.9, times: [0, 0.4, 1], delay: i * 0.04, ease: [0.22, 1, 0.36, 1] }}
                style={{ filter: "drop-shadow(0 0 6px rgba(167,139,250,.8))" }}
              />
            ))}
            <motion.circle r={60} fill="none" stroke="#6ef2c0" strokeWidth={1.2}
              initial={{ scale: 0, opacity: 0 }} animate={{ scale: [0, 2.4], opacity: [0.9, 0] }}
              transition={{ duration: 0.9, delay: 1.75, ease: "easeOut" }} />
          </svg>
          <div className="-mt-16 flex font-display text-3xl font-bold tracking-tight sm:text-4xl" aria-label={NAME}>
            {NAME.split("").map((ch, i) => (
              <motion.span key={i} className={i >= 7 ? "text-violet" : "text-text"}
                initial={{ opacity: 0, y: 14, filter: "blur(8px)" }}
                animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
                transition={{ delay: 1.2 + i * 0.035, duration: 0.45, ease: "easeOut" }}>
                {ch}
              </motion.span>
            ))}
          </div>
          <motion.p className="mt-3 font-mono text-xs uppercase tracking-[0.3em] text-muted"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 1.8 }}>
            growing synapses…
          </motion.p>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
