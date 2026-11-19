"use client";

import { motion, useMotionTemplate, useMotionValue, useSpring, useTransform } from "motion/react";
import { useEffect, useRef, useState, type ReactNode } from "react";

/** Pulls its child toward the cursor with spring physics (capped, keyboard-safe). */
export function Magnetic({ children, strength = 0.3, className = "" }: { children: ReactNode; strength?: number; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const x = useSpring(0, { stiffness: 220, damping: 14, mass: 0.4 });
  const y = useSpring(0, { stiffness: 220, damping: 14, mass: 0.4 });
  return (
    <motion.div ref={ref} className={`inline-block ${className}`} style={{ x, y }}
      onPointerMove={(e) => {
        if (e.pointerType !== "mouse") return;
        const r = ref.current!.getBoundingClientRect();
        const dx = e.clientX - (r.left + r.width / 2), dy = e.clientY - (r.top + r.height / 2);
        x.set(Math.max(-22, Math.min(22, dx * strength))); y.set(Math.max(-16, Math.min(16, dy * strength)));
      }}
      onPointerLeave={() => { x.set(0); y.set(0); }}>
      {children}
    </motion.div>
  );
}

/** 3D tilt that follows the pointer, with a moving glare highlight. */
export function Tilt({ children, className = "", max = 9 }: { children: ReactNode; className?: string; max?: number }) {
  const ref = useRef<HTMLDivElement>(null);
  const px = useMotionValue(0.5), py = useMotionValue(0.5);
  const rotX = useSpring(useTransform(py, [0, 1], [max, -max]), { stiffness: 180, damping: 18 });
  const rotY = useSpring(useTransform(px, [0, 1], [-max, max]), { stiffness: 180, damping: 18 });
  const gx = useTransform(px, (v) => `${v * 100}%`), gy = useTransform(py, (v) => `${v * 100}%`);
  const glare = useMotionTemplate`radial-gradient(520px circle at ${gx} ${gy}, rgba(255,255,255,.10), transparent 40%)`;
  return (
    <div style={{ perspective: 1100 }} className={className}>
      <motion.div ref={ref} className="relative h-full" style={{ rotateX: rotX, rotateY: rotY, transformStyle: "preserve-3d" }}
        onPointerMove={(e) => { const r = ref.current!.getBoundingClientRect(); px.set((e.clientX - r.left) / r.width); py.set((e.clientY - r.top) / r.height); }}
        onPointerLeave={() => { px.set(0.5); py.set(0.5); }}>
        {children}
        <motion.div className="pointer-events-none absolute inset-0 rounded-[inherit]" style={{ background: glare }} />
      </motion.div>
    </div>
  );
}

const GLYPHS = "!<>-_\\/[]{}—=+*^?#01";

/** Text that decodes from random glyphs; replays on hover. */
export function Decode({ text, className = "", trigger = "mount" }: { text: string; className?: string; trigger?: "mount" | "hover" }) {
  const [out, setOut] = useState(text);
  const [run, setRun] = useState(trigger === "mount" ? 1 : 0);
  useEffect(() => {
    if (!run) return;
    let frame = 0, raf = 0;
    const total = text.length * 2 + 8;
    const tick = () => {
      frame++;
      setOut(text.split("").map((ch, i) => (ch === " " || frame / 2 > i ? ch : GLYPHS[(Math.random() * GLYPHS.length) | 0])).join(""));
      if (frame < total) raf = requestAnimationFrame(tick); else setOut(text);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [run, text]);
  return <span className={className} onPointerEnter={() => setRun((r) => r + 1)}>{out}</span>;
}

/** Lenis smooth scrolling for the marketing page only (the app keeps native scroll). */
export function SmoothScroll() {
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    let raf = 0, alive = true;
    let lenis: { raf: (t: number) => void; destroy: () => void } | null = null;
    import("lenis").then(({ default: Lenis }) => {
      if (!alive) return;
      lenis = new Lenis({ lerp: 0.09, anchors: true });
      const loop = (t: number) => { lenis?.raf(t); raf = requestAnimationFrame(loop); };
      raf = requestAnimationFrame(loop);
    });
    return () => { alive = false; cancelAnimationFrame(raf); lenis?.destroy(); };
  }, []);
  return null;
}
