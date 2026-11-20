"use client";

import { motion, useMotionValueEvent, useScroll, useSpring, useTransform } from "motion/react";
import { useEffect, useState } from "react";

const SECTIONS = [
  { id: "top", label: "Start" },
  { id: "preview", label: "The app" },
  { id: "how", label: "How it works" },
  { id: "notes", label: "Field notes" },
  { id: "proof", label: "Proof" },
];

/**
 * The page's spine: an axon down the left edge that fills as you scroll, with a signal
 * travelling at its tip and a node per section that lights up when you reach it.
 */
export function ScrollSpine() {
  const { scrollYProgress } = useScroll();
  const fill = useSpring(scrollYProgress, { stiffness: 120, damping: 24, mass: 0.3 });
  const tip = useTransform(fill, (v) => `${Math.min(100, Math.max(0, v * 100))}%`);
  const [stops, setStops] = useState<number[]>([]);
  const [active, setActive] = useState(0);

  useEffect(() => {
    const measure = () => {
      const max = document.documentElement.scrollHeight - innerHeight;
      setStops(SECTIONS.map((s) => {
        const el = s.id === "top" ? document.body : document.getElementById(s.id);
        return el && max > 0 ? Math.min(1, Math.max(0, (el.getBoundingClientRect().top + scrollY - innerHeight * 0.3) / max)) : 0;
      }));
    };
    measure();
    const t = setTimeout(measure, 1500); // after fonts/3D settle
    addEventListener("resize", measure);
    return () => { clearTimeout(t); removeEventListener("resize", measure); };
  }, []);

  useMotionValueEvent(scrollYProgress, "change", (v) => {
    let a = 0;
    stops.forEach((s, i) => { if (v >= s - 0.005) a = i; });
    setActive(a);
  });

  const go = (id: string) => {
    const el = id === "top" ? document.body : document.getElementById(id);
    el?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  return (
    <>
      {/* desktop: the spine */}
      <nav aria-label="Page sections" className="fixed top-[16vh] bottom-[12vh] left-5 z-40 hidden w-40 xl:block 2xl:left-8">
        <div className="absolute top-0 bottom-0 left-[7px] w-[2px] rounded-full bg-carbon/10" />
        <motion.div className="absolute top-0 left-[7px] w-[2px] origin-top rounded-full bg-gradient-to-b from-carbon via-signal to-signal"
          style={{ scaleY: fill, height: "100%" }} />
        {/* the travelling signal */}
        <motion.div className="absolute left-[8px] -translate-x-1/2 -translate-y-1/2" style={{ top: tip }}>
          <span className="block h-3.5 w-3.5 rounded-full bg-signal shadow-[0_0_0_4px_rgba(232,85,31,.18),0_0_18px_rgba(232,85,31,.7)]" />
          <motion.span className="absolute inset-0 rounded-full border border-signal" animate={{ scale: [1, 2.6], opacity: [0.7, 0] }}
            transition={{ duration: 1.6, repeat: Infinity, ease: "easeOut" }} />
        </motion.div>
        {SECTIONS.map((s, i) => (
          <button key={s.id} onClick={() => go(s.id)} data-cursor={s.label} aria-label={`Go to ${s.label}`} aria-current={i === active ? "location" : undefined}
            className="group absolute left-0 flex -translate-y-1/2 items-center gap-3" style={{ top: `${(stops[i] ?? i / 4) * 100}%` }}>
            <motion.span className="block h-4 w-4 rounded-full border-2"
              animate={{ backgroundColor: i <= active ? "#16130f" : "#f3eee3", borderColor: i <= active ? "#16130f" : "#cfc4ad", scale: i === active ? 1.15 : 1 }}
              transition={{ type: "spring", stiffness: 300, damping: 20 }} />
            <motion.span className="hidden font-mono text-[10.5px] tracking-[0.18em] uppercase 2xl:inline"
              animate={{ opacity: i === active ? 1 : 0.0, x: i === active ? 0 : -6 }}
              style={{ color: "#16130f" }}>
              {s.label}
            </motion.span>
            <span className="pointer-events-none absolute left-7 hidden font-mono 2xl:inline text-[10.5px] tracking-[0.18em] text-graphite uppercase opacity-0 transition group-hover:opacity-100">
              {i === active ? "" : s.label}
            </span>
          </button>
        ))}
      </nav>
      {/* mobile: a thin progress bar */}
      <motion.div className="fixed top-0 right-0 left-0 z-50 h-[3px] origin-left bg-signal xl:hidden" style={{ scaleX: fill }} />
    </>
  );
}
