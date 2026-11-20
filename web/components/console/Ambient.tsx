"use client";

import { motion, useMotionTemplate, useMotionValue, useSpring } from "motion/react";
import { useEffect } from "react";

/** The workspace atmosphere: drifting aurora, a spatial grid floor, a cursor spotlight and grain. */
export function Ambient() {
  const x = useMotionValue(-1000), y = useMotionValue(-1000);
  const sx = useSpring(x, { stiffness: 120, damping: 25 }), sy = useSpring(y, { stiffness: 120, damping: 25 });
  const spot = useMotionTemplate`radial-gradient(520px circle at ${sx}px ${sy}px, rgba(255,150,100,0.10), transparent 60%)`;
  useEffect(() => {
    const move = (e: PointerEvent) => { x.set(e.clientX); y.set(e.clientY); };
    addEventListener("pointermove", move);
    return () => removeEventListener("pointermove", move);
  }, [x, y]);
  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 z-0 overflow-hidden bg-ink">
      <div className="aurora-1 absolute top-[-20%] left-[-10%] h-[70vh] w-[60vw] rounded-full bg-[#e8551f]/25 blur-[120px]" />
      <div className="aurora-2 absolute right-[-15%] bottom-[-20%] h-[75vh] w-[55vw] rounded-full bg-[#2346d8]/25 blur-[130px]" />
      <div className="aurora-3 absolute top-[30%] left-[35%] h-[45vh] w-[35vw] rounded-full bg-[#3e7c4f]/18 blur-[120px]" />
      <div className="absolute inset-x-[-20%] top-[55%] h-[80vh]">
        <div className="grid-floor h-full w-full" />
      </div>
      <div className="vignette absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_40%,rgba(8,6,4,.75)_100%)]" />
      <motion.div className="absolute inset-0" style={{ background: spot }} />
    </div>
  );
}
