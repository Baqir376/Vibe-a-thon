"use client";

import { useEffect, useRef } from "react";

/**
 * Living background: drifting neurons that wire up when close, brighten near the cursor,
 * and fire signal pulses along their connections. Canvas 2D, pauses off-screen.
 */
export function NeuralField({ density = 0.00009, className = "" }: { density?: number; className?: string }) {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current!;
    const ctx = canvas.getContext("2d")!;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let w = 0, h = 0, raf = 0, visible = true;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const mouse = { x: -9999, y: -9999 };
    type N = { x: number; y: number; vx: number; vy: number; r: number };
    let nodes: N[] = [];
    type P = { a: number; b: number; t: number; speed: number };
    let pulses: P[] = [];
    const LINK = 150;
    // cursor trail and click shockwaves
    let trail: { x: number; y: number; life: number }[] = [];
    let bursts: { x: number; y: number; r: number }[] = [];

    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      w = rect.width; h = rect.height;
      canvas.width = w * dpr; canvas.height = h * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      const n = Math.max(28, Math.min(110, Math.floor(w * h * density)));
      nodes = Array.from({ length: n }, () => ({
        x: Math.random() * w, y: Math.random() * h,
        vx: (Math.random() - 0.5) * 0.25, vy: (Math.random() - 0.5) * 0.25, r: 1 + Math.random() * 1.6,
      }));
      pulses = [];
    };

    const step = () => {
      ctx.clearRect(0, 0, w, h);
      // shockwaves: expanding rings that push neurons and make nearby synapses fire
      bursts = bursts.filter((b) => b.r < 420);
      for (const b of bursts) {
        b.r += 9;
        ctx.strokeStyle = `rgba(196,181,253,${0.55 * (1 - b.r / 420)})`;
        ctx.lineWidth = 1.5;
        ctx.beginPath(); ctx.arc(b.x, b.y, b.r, 0, Math.PI * 2); ctx.stroke();
        for (const n of nodes) {
          const dx = n.x - b.x, dy = n.y - b.y, d = Math.hypot(dx, dy);
          if (Math.abs(d - b.r) < 12 && d > 0) { n.x += (dx / d) * 2.4; n.y += (dy / d) * 2.4; }
        }
      }
      // synapse trail behind the cursor
      trail = trail.filter((t) => (t.life -= 0.035) > 0);
      for (let i = 1; i < trail.length; i++) {
        const a = trail[i - 1], b = trail[i];
        ctx.strokeStyle = `rgba(110,242,192,${b.life * 0.5})`;
        ctx.lineWidth = 2 * b.life;
        ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
      }
      for (const n of nodes) {
        if (!reduce) { n.x += n.vx; n.y += n.vy; }
        if (n.x < 0 || n.x > w) n.vx *= -1;
        if (n.y < 0 || n.y > h) n.vy *= -1;
        const dx = mouse.x - n.x, dy = mouse.y - n.y, d = Math.hypot(dx, dy);
        if (d < 180 && !reduce) { n.x += dx * 0.0025; n.y += dy * 0.0025; }
      }
      // connections
      for (let i = 0; i < nodes.length; i++) {
        for (let j = i + 1; j < nodes.length; j++) {
          const a = nodes[i], b = nodes[j];
          const d = Math.hypot(a.x - b.x, a.y - b.y);
          if (d > LINK) continue;
          const near = Math.hypot(mouse.x - (a.x + b.x) / 2, mouse.y - (a.y + b.y) / 2) < 160;
          const alpha = (1 - d / LINK) * (near ? 0.55 : 0.16);
          ctx.strokeStyle = near ? `rgba(167,139,250,${alpha})` : `rgba(90,120,190,${alpha})`;
          ctx.lineWidth = near ? 1.1 : 0.7;
          ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
          if (!reduce && Math.random() < (near ? 0.004 : 0.0006) && pulses.length < 40)
            pulses.push({ a: i, b: j, t: 0, speed: 0.012 + Math.random() * 0.02 });
        }
      }
      // pulses travelling along edges
      pulses = pulses.filter((p) => p.t <= 1);
      for (const p of pulses) {
        p.t += p.speed;
        const a = nodes[p.a], b = nodes[p.b];
        if (!a || !b) continue;
        const x = a.x + (b.x - a.x) * p.t, y = a.y + (b.y - a.y) * p.t;
        const g = ctx.createRadialGradient(x, y, 0, x, y, 7);
        g.addColorStop(0, "rgba(110,242,192,0.95)"); g.addColorStop(1, "rgba(110,242,192,0)");
        ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, 7, 0, Math.PI * 2); ctx.fill();
      }
      // neurons
      for (const n of nodes) {
        const near = Math.hypot(mouse.x - n.x, mouse.y - n.y) < 140;
        ctx.fillStyle = near ? "rgba(196,181,253,0.95)" : "rgba(120,150,220,0.55)";
        ctx.beginPath(); ctx.arc(n.x, n.y, near ? n.r + 0.8 : n.r, 0, Math.PI * 2); ctx.fill();
      }
      if (visible) raf = requestAnimationFrame(step);
    };

    const onMove = (e: PointerEvent) => {
      const r = canvas.getBoundingClientRect();
      mouse.x = e.clientX - r.left; mouse.y = e.clientY - r.top;
      if (!reduce && mouse.y > 0 && mouse.y < h) trail = [...trail, { x: mouse.x, y: mouse.y, life: 1 }].slice(-26);
    };
    const onDown = (e: PointerEvent) => {
      const r = canvas.getBoundingClientRect();
      const x = e.clientX - r.left, y = e.clientY - r.top;
      if (reduce || y < 0 || y > h) return;
      bursts.push({ x, y, r: 4 });
      // fire every synapse near the click
      nodes.forEach((a, i) => nodes.forEach((b, j) => {
        if (j > i && Math.hypot(a.x - x, a.y - y) < 220 && Math.hypot(a.x - b.x, a.y - b.y) < LINK && pulses.length < 90)
          pulses.push({ a: i, b: j, t: 0, speed: 0.02 + Math.random() * 0.03 });
      }));
    };
    const onLeave = () => { mouse.x = -9999; mouse.y = -9999; };
    const io = new IntersectionObserver(([e]) => {
      visible = e.isIntersecting;
      cancelAnimationFrame(raf);
      if (visible) raf = requestAnimationFrame(step);
    });

    resize();
    io.observe(canvas);
    window.addEventListener("resize", resize);
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerdown", onDown);
    document.addEventListener("pointerleave", onLeave);
    return () => {
      window.removeEventListener("pointerdown", onDown);
      cancelAnimationFrame(raf); io.disconnect();
      window.removeEventListener("resize", resize);
      window.removeEventListener("pointermove", onMove);
      document.removeEventListener("pointerleave", onLeave);
    };
  }, [density]);

  return <canvas ref={ref} className={`absolute inset-0 h-full w-full ${className}`} aria-hidden />;
}
