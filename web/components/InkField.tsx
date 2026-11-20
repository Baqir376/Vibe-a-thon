"use client";

import { useEffect, useRef } from "react";

/**
 * Cajal ink: moving the pointer grows hand-drawn neurons along its path; a click plants a big one.
 * Branches are generated once (random walk + forks), then "drawn" progressively with tapering ink.
 * Old neurons fade like drying ink. Orange signals occasionally race along fresh branches.
 */
type Branch = { pts: [number, number][]; w: number; delay: number };
type Neuron = { x: number; y: number; r: number; branches: Branch[]; born: number; hot: boolean; signals: { b: number; t: number }[] };

function grow(x: number, y: number, angle: number, len: number, w: number, depth: number, delay: number, out: Branch[]) {
  const pts: [number, number][] = [[x, y]];
  let a = angle, cx = x, cy = y;
  const steps = Math.max(4, Math.round(len / 6));
  for (let i = 0; i < steps; i++) {
    a += (Math.random() - 0.5) * 0.5;
    cx += Math.cos(a) * (len / steps); cy += Math.sin(a) * (len / steps);
    pts.push([cx, cy]);
  }
  out.push({ pts, w, delay });
  if (depth <= 0) return;
  const forks = Math.random() < 0.75 ? 2 : 1;
  for (let f = 0; f < forks; f++) {
    const k = Math.floor(steps * (0.55 + Math.random() * 0.4));
    const [bx, by] = pts[k];
    grow(bx, by, a + (f === 0 ? -1 : 1) * (0.35 + Math.random() * 0.6), len * (0.55 + Math.random() * 0.2), w * 0.62, depth - 1,
      delay + k / steps, out);
  }
}

function neuron(x: number, y: number, big: boolean): Neuron {
  const branches: Branch[] = [];
  const n = big ? 7 : 3 + Math.floor(Math.random() * 3);
  const base = Math.random() * Math.PI * 2;
  for (let i = 0; i < n; i++) {
    const a = base + (i / n) * Math.PI * 2 + (Math.random() - 0.5) * 0.6;
    grow(x, y, a, (big ? 70 : 34) + Math.random() * (big ? 60 : 30), big ? 2.6 : 1.7, big ? 3 : 2, 0, branches);
  }
  if (big) grow(x, y, base + Math.PI * 0.9, 220, 2.2, 1, 0, branches); // the axon
  return { x, y, r: big ? 7 : 3.4, branches, born: performance.now(), hot: big, signals: [] };
}

export function InkField({ className = "", tone = "paper" }: { className?: string; tone?: "paper" | "night" }) {
  const ink = tone === "night" ? "241,234,220" : "22,19,15";
  const sig = tone === "night" ? "255,122,69" : "232,85,31";
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const canvas = ref.current!;
    const ctx = canvas.getContext("2d")!;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    let w = 0, h = 0, raf = 0, visible = true;
    let neurons: Neuron[] = [];
    let last = { x: -999, y: -999 };

    const resize = () => {
      const r = canvas.getBoundingClientRect();
      w = r.width; h = r.height;
      canvas.width = w * dpr; canvas.height = h * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    const seed = () => {
      // a few neurons already on the page, so it never looks empty
      for (let i = 0; i < 5; i++) neurons.push({ ...neuron(w * (0.08 + Math.random() * 0.84), h * (0.1 + Math.random() * 0.8), false), born: performance.now() - i * 1500 });
    };

    const draw = (now: number) => {
      ctx.clearRect(0, 0, w, h);
      neurons = neurons.filter((n) => now - n.born < 16000);
      // keep the page alive: a few ambient neurons always growing somewhere
      if (neurons.length < 5 && Math.random() < 0.02)
        neurons.push(neuron(w * (0.05 + Math.random() * 0.9), h * (0.08 + Math.random() * 0.84), false));
      for (const n of neurons) {
        const age = (now - n.born) / 1000;
        const fade = Math.max(0, Math.min(1, 1 - (age - 9) / 7));   // dry & fade after 9s
        const prog = reduce ? 99 : age * 1.6;                        // drawing speed
        ctx.lineCap = "round"; ctx.lineJoin = "round";
        n.branches.forEach((b, bi) => {
          const p = Math.max(0, Math.min(1, prog - b.delay));
          if (p <= 0) return;
          const upto = Math.max(1, Math.floor(p * (b.pts.length - 1)));
          for (let i = 1; i <= upto; i++) {
            const t = i / (b.pts.length - 1);
            ctx.strokeStyle = `rgba(${ink},${(n.hot ? 0.62 : 0.4) * (tone === "night" ? 0.55 : 1) * fade})`;
            ctx.lineWidth = Math.max(0.35, b.w * (1 - t * 0.75));
            ctx.beginPath(); ctx.moveTo(b.pts[i - 1][0], b.pts[i - 1][1]); ctx.lineTo(b.pts[i][0], b.pts[i][1]); ctx.stroke();
          }
          // occasional signal on a fully drawn branch
          if (!reduce && p >= 1 && fade > 0.6 && Math.random() < (n.hot ? 0.012 : 0.003)) n.signals.push({ b: bi, t: 0 });
        });
        // soma
        ctx.fillStyle = n.hot ? `rgba(${sig},${fade})` : `rgba(${ink},${0.55 * fade})`;
        if (tone === "night" && n.hot) { ctx.shadowColor = `rgba(${sig},.9)`; ctx.shadowBlur = 16; }
        ctx.beginPath(); ctx.ellipse(n.x, n.y, n.r * 1.15, n.r, 0.4, 0, Math.PI * 2); ctx.fill();
        ctx.shadowBlur = 0;
        // signals
        n.signals = n.signals.filter((s) => s.t <= 1);
        for (const s of n.signals) {
          s.t += 0.03;
          const pts = n.branches[s.b].pts, k = Math.min(pts.length - 1, Math.floor(s.t * (pts.length - 1)));
          const [x, y] = pts[k];
          ctx.fillStyle = `rgba(${sig},${0.9 * fade})`;
          ctx.beginPath(); ctx.arc(x, y, 2.6, 0, Math.PI * 2); ctx.fill();
        }
      }
      if (visible) raf = requestAnimationFrame(draw);
    };

    const onMove = (e: PointerEvent) => {
      const r = canvas.getBoundingClientRect();
      const x = e.clientX - r.left, y = e.clientY - r.top;
      if (x < 0 || y < 0 || x > w || y > h) return;
      if (Math.hypot(x - last.x, y - last.y) > 70) {
        last = { x, y };
        neurons.push(neuron(x + (Math.random() - 0.5) * 20, y + (Math.random() - 0.5) * 20, false));
        if (neurons.length > 60) neurons.shift();
      }
    };
    const onDown = (e: PointerEvent) => {
      const r = canvas.getBoundingClientRect();
      const x = e.clientX - r.left, y = e.clientY - r.top;
      if (x < 0 || y < 0 || x > w || y > h) return;
      if ((e.target as HTMLElement)?.closest?.("a,button,canvas[data-three]")) return;
      neurons.push(neuron(x, y, true));
    };
    const io = new IntersectionObserver(([e]) => {
      visible = e.isIntersecting;
      cancelAnimationFrame(raf);
      if (visible) raf = requestAnimationFrame(draw);
    });

    resize(); seed();
    io.observe(canvas);
    window.addEventListener("resize", resize);
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerdown", onDown);
    return () => {
      cancelAnimationFrame(raf); io.disconnect();
      window.removeEventListener("resize", resize);
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerdown", onDown);
    };
  }, [ink, sig, tone]);
  return <canvas ref={ref} className={`absolute inset-0 h-full w-full ${className}`} aria-hidden />;
}
