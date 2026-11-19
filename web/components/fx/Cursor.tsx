"use client";

import { AnimatePresence, motion, useMotionValue, useSpring } from "motion/react";
import { useEffect, useState } from "react";

/**
 * Custom cursor: an exact dot plus a spring-trailing ring (blend-mode difference).
 * Over links/buttons the ring grows; elements with data-cursor="Label" show that label.
 * Disabled on touch devices and for reduced motion; text fields keep the native caret.
 */
export function Cursor() {
  const [enabled, setEnabled] = useState(false);
  const [hover, setHover] = useState<{ on: boolean; label: string | null }>({ on: false, label: null });
  const [down, setDown] = useState(false);
  const [hidden, setHidden] = useState(true);
  const x = useMotionValue(-100), y = useMotionValue(-100);
  const rx = useSpring(x, { stiffness: 380, damping: 32, mass: 0.6 });
  const ry = useSpring(y, { stiffness: 380, damping: 32, mass: 0.6 });

  useEffect(() => {
    const fine = window.matchMedia("(pointer: fine)").matches;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (!fine || reduce) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- capability check after mount (no SSR access to matchMedia)
    setEnabled(true);
    document.documentElement.classList.add("custom-cursor");
    const move = (e: PointerEvent) => {
      x.set(e.clientX); y.set(e.clientY); setHidden(false);
      const t = (e.target as HTMLElement | null)?.closest?.("a,button,[data-cursor]") as HTMLElement | null;
      setHover({ on: !!t, label: t?.dataset.cursor ?? null });
    };
    const leave = () => setHidden(true);
    const d = () => setDown(true), u = () => setDown(false);
    window.addEventListener("pointermove", move);
    document.addEventListener("pointerleave", leave);
    window.addEventListener("pointerdown", d);
    window.addEventListener("pointerup", u);
    return () => {
      document.documentElement.classList.remove("custom-cursor");
      window.removeEventListener("pointermove", move);
      document.removeEventListener("pointerleave", leave);
      window.removeEventListener("pointerdown", d);
      window.removeEventListener("pointerup", u);
    };
  }, [x, y]);

  if (!enabled) return null;
  const size = hover.label ? 84 : hover.on ? 52 : 30;
  return (
    <>
      <motion.div aria-hidden className="pointer-events-none fixed top-0 left-0 z-[200] rounded-full bg-white mix-blend-difference"
        style={{ x, y, translateX: "-50%", translateY: "-50%", width: 6, height: 6, opacity: hidden || hover.label ? 0 : 1 }} />
      <motion.div aria-hidden
        className="pointer-events-none fixed top-0 left-0 z-[199] flex items-center justify-center rounded-full border border-white mix-blend-difference"
        style={{ x: rx, y: ry, translateX: "-50%", translateY: "-50%", opacity: hidden ? 0 : 1 }}
        animate={{ width: size, height: size, scale: down ? 0.82 : 1, backgroundColor: hover.label ? "rgba(255,255,255,1)" : "rgba(255,255,255,0)" }}
        transition={{ type: "spring", stiffness: 300, damping: 24 }}>
        <AnimatePresence>
          {hover.label && (
            <motion.span key={hover.label} initial={{ opacity: 0, scale: 0.6 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }}
              className="font-display text-[11px] font-semibold tracking-wide text-black">{hover.label}</motion.span>
          )}
        </AnimatePresence>
      </motion.div>
    </>
  );
}
