"use client";

import { AnimatePresence, motion } from "motion/react";
import { useEffect, useState } from "react";

// A neuron drawn in ink, the way Cajal drew them, while the name writes itself.
const DENDRITES = [
  "M0 0 C -30 -20, -60 -30, -95 -70 M-60 -38 C -80 -40, -100 -30, -120 -36",
  "M0 0 C 25 -30, 40 -70, 70 -105 M42 -62 C 60 -66, 80 -60, 96 -72",
  "M0 0 C 40 -5, 80 10, 120 -10 M84 4 C 96 20, 110 30, 128 34",
  "M0 0 C -40 10, -80 30, -118 22",
  "M0 0 C 10 40, 20 80, 60 150 M30 96 C 10 110, 0 130, -10 150",
];
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
    }, 2500);
    return () => clearTimeout(t);
  }, [skip]);

  return (
    <AnimatePresence>
      {show && (
        <motion.div key="boot" className="boot-overlay paper-page fixed inset-0 z-[100] flex flex-col items-center justify-center"
          exit={{ clipPath: "inset(0 0 100% 0)", transition: { duration: 0.8, ease: [0.76, 0, 0.24, 1] } }}
          onClick={() => setSkip(true)} style={{ clipPath: "inset(0 0 0% 0)" }}>
          <svg width="320" height="300" viewBox="-160 -130 320 300" className="max-w-[80vw]">
            {DENDRITES.map((d, i) => (
              <motion.path key={i} d={d} fill="none" stroke="#16130f" strokeWidth={i === 4 ? 2.6 : 2} strokeLinecap="round"
                initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ delay: 0.15 + i * 0.12, duration: 1.1, ease: "easeInOut" }} />
            ))}
            <motion.ellipse rx={13} ry={11} fill="#e8551f" initial={{ scale: 0 }} animate={{ scale: [0, 1.25, 1] }}
              transition={{ delay: 0.05, duration: 0.6 }} />
            <motion.circle r={4} fill="#fff6ee" initial={{ opacity: 0 }} animate={{ opacity: [0, 1, 0.6, 1] }} transition={{ delay: 0.5, duration: 1.4, repeat: Infinity }} cx={3} cy={-2} />
            <motion.circle r={3.5} fill="#e8551f" initial={{ offsetDistance: "0%", opacity: 0 }} animate={{ offsetDistance: "100%", opacity: [0, 1, 1, 0] }}
              style={{ offsetPath: 'path("M0 0 C 10 40, 20 80, 60 150")' }} transition={{ delay: 1.3, duration: 0.9, ease: "easeIn" }} />
          </svg>
          <div className="-mt-6 flex font-display text-4xl font-semibold tracking-tight text-carbon" aria-label={NAME}>
            {NAME.split("").map((ch, i) => (
              <motion.span key={i} className={i >= 7 ? "italic text-signal" : ""}
                initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 1.0 + i * 0.04, duration: 0.4 }}>
                {ch}
              </motion.span>
            ))}
          </div>
          <motion.p className="mt-2 font-hand text-xl text-graphite" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 1.6 }}>
            growing synapses…
          </motion.p>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
