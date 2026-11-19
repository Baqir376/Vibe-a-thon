"use client";

import { AnimatePresence, motion } from "motion/react";
import { useEffect, useMemo, useRef, useState } from "react";
import type { Capability, System } from "@/lib/api";
import { key, type ConsoleState } from "@/lib/useConsole";

const W = 1000, H = 720, C = { x: W / 2, y: H / 2 + 10 };
const ANGLE: Record<string, number> = { orders: -148, inventory: -32, tickets: 32, roster: 148, tickets_fused: 90 };
const RX = 300, RY = 225, REP = 112;

type EP = { k: string; cap: Capability; x: number; y: number; ang: number; sys: string };

function layout(systems: System[], caps: Capability[]) {
  const pos: Record<string, { x: number; y: number; ang: number }> = {};
  systems.forEach((s, i) => {
    const deg = ANGLE[s.name] ?? -90 + i * 72;
    const a = (deg * Math.PI) / 180;
    pos[s.name] = { x: C.x + RX * Math.cos(a), y: C.y + RY * Math.sin(a), ang: deg };
  });
  const eps: EP[] = [];
  systems.forEach((s) => {
    const list = caps.filter((c) => c.system === s.name);
    const n = list.length, spread = Math.min(230, 22 * n), p = pos[s.name];
    list.forEach((cap, j) => {
      const off = n > 1 ? -spread / 2 + (spread * j) / (n - 1) : 0;
      const a = ((p.ang + off) * Math.PI) / 180;
      eps.push({ k: key(s.name, cap.spec), cap, sys: s.name, ang: p.ang + off, x: p.x + REP * Math.cos(a), y: p.y + REP * Math.sin(a) });
    });
  });
  return { pos, eps };
}

const linkD = (sx: number, sy: number, ex: number, ey: number) => `M ${C.x} ${C.y} Q ${sx} ${sy} ${ex} ${ey}`;

export function NeuralMap({ s, onPulseDone }: { s: ConsoleState; onPulseDone: (id: number) => void }) {
  const { pos, eps } = useMemo(() => layout(s.systems, s.caps), [s.systems, s.caps]);
  const [hoverSys, setHoverSys] = useState<string | null>(null);
  const linked = eps.filter((e) => s.live.includes(e.k) || s.dormant.includes(e.k));

  return (
    <svg viewBox={`-90 -10 ${W + 180} ${H + 20}`} className="h-full w-full select-none" preserveAspectRatio="xMidYMid meet">
      <defs>
        <radialGradient id="core"><stop offset="0%" stopColor="#c4b5fd" /><stop offset="55%" stopColor="#7c3aed" /><stop offset="100%" stopColor="#2e1065" /></radialGradient>
        <radialGradient id="sys"><stop offset="0%" stopColor="#1d2a4a" /><stop offset="100%" stopColor="#0c1324" /></radialGradient>
        <filter id="glow" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="4" result="b" /><feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge></filter>
      </defs>

      {/* dendrites */}
      {s.systems.map((sys) => pos[sys.name] && (
        <line key={sys.name} x1={C.x} y1={C.y} x2={pos[sys.name].x} y2={pos[sys.name].y} stroke="#18233d" strokeDasharray="2 7" />
      ))}
      {eps.map((e) => (
        <line key={"d" + e.k} x1={pos[e.sys].x} y1={pos[e.sys].y} x2={e.x} y2={e.y} stroke="#18233d" />
      ))}

      {/* grafted (live) and dormant links */}
      {linked.map((e) => {
        const live = s.live.includes(e.k);
        const color = e.sys.endsWith("_fused") ? "#a78bfa" : e.cap.mutating ? "#ffb547" : "#6ef2c0";
        const d = linkD(pos[e.sys].x, pos[e.sys].y, e.x, e.y);
        return (
          <g key={"l" + e.k}>
            {/* solid stroke draws itself in; pathLength owns its dasharray */}
            <motion.path id={"path-" + e.k} d={d} fill="none"
              initial={{ pathLength: 0, opacity: 0 }}
              animate={{ pathLength: 1, opacity: live ? 0.95 : 0.3, stroke: live ? color : "#33456a", strokeWidth: live ? 2.4 : 1.2 }}
              transition={{ pathLength: { duration: 0.9, ease: [0.22, 1, 0.36, 1] }, default: { duration: 0.5 } }}
              filter={live ? "url(#glow)" : undefined} />
            {/* dashed overlay: flowing signal when live, dotted when dormant */}
            <motion.path d={d} fill="none" strokeDasharray={live ? "5 11" : "3 7"} className={live ? "link-flow" : ""}
              initial={{ opacity: 0 }} animate={{ opacity: 1, stroke: live ? "#f4fffb" : "#33456a", strokeWidth: live ? 2.2 : 1.2 }}
              transition={{ duration: 0.4, delay: live ? 0.7 : 0 }} />
          </g>
        );
      })}

      {/* signal pulses for tool calls */}
      {s.pulses.map((p) => <PulseDot key={p.id} id={p.id} pathId={"path-" + p.key} onDone={onPulseDone} />)}

      {/* endpoints */}
      {eps.map((e) => {
        const live = s.live.includes(e.k), dormant = s.dormant.includes(e.k), fresh = s.fresh.includes(e.k);
        const fused = e.sys.endsWith("_fused");
        const base = fused ? "#a78bfa" : e.cap.mutating ? "#ffb547" : "#38d6f5";
        const showLabel = live || fresh || fused || hoverSys === e.sys;
        const right = Math.cos((e.ang * Math.PI) / 180) >= 0;
        return (
          <g key={"e" + e.k}>
            <motion.circle cx={e.x} cy={e.y}
              initial={fresh ? { r: 0 } : false}
              animate={{ r: live ? 7.5 : fresh ? 8 : fused ? 7 : 5,
                         fill: live ? (fused ? "#a78bfa" : e.cap.mutating ? "#ffb547" : "#6ef2c0") : dormant ? "rgba(0,0,0,0)" : fresh ? "#ffd84d" : base,
                         opacity: live || fresh || fused ? 1 : dormant ? 0.9 : 0.32,
                         stroke: dormant && !live ? "#3a4a6b" : "rgba(0,0,0,0)" }}
              strokeWidth={1.6} transition={{ type: "spring", stiffness: 260, damping: 16 }}
              filter={live || fresh ? "url(#glow)" : undefined}>
              <title>{`${e.sys} · ${e.cap.spec}\n${e.cap.description}`}</title>
            </motion.circle>
            {fresh && (
              <motion.circle cx={e.x} cy={e.y} r={8} fill="none" stroke="#ffd84d"
                animate={{ r: [8, 26], opacity: [0.9, 0] }} transition={{ duration: 1.6, repeat: Infinity }} />
            )}
            <AnimatePresence>
              {showLabel && (
                <motion.text initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                  x={e.x + (right ? 12 : -12)} y={e.y + 3.5} textAnchor={right ? "start" : "end"}
                  className="font-mono text-[10.5px]" fill={fresh ? "#ffd84d" : live ? "#e8eefb" : "#8392b0"}>
                  {e.cap.spec.replace(/\{[^}]+\}/g, "{…}")}
                </motion.text>
              )}
            </AnimatePresence>
          </g>
        );
      })}

      {/* systems */}
      {s.systems.map((sys) => {
        const p = pos[sys.name];
        if (!p) return null;
        const building = s.building.includes(sys.name);
        const active = s.live.some((k) => k.startsWith(sys.name + "|"));
        const fused = sys.mode === "fused";
        return (
          <g key={sys.name} onPointerEnter={() => setHoverSys(sys.name)} onPointerLeave={() => setHoverSys(null)} className="cursor-default">
            {building && [0, 0.5].map((d) => (
              <motion.circle key={d} cx={p.x} cy={p.y} r={38} fill="none" stroke="#a78bfa" strokeWidth={2}
                animate={{ r: [38, 92], opacity: [0.9, 0] }} transition={{ duration: 1.2, repeat: Infinity, delay: d }} />
            ))}
            <motion.circle cx={p.x} cy={p.y} r={38} fill="url(#sys)"
              initial={fused ? { scale: 0 } : false}
              animate={{ stroke: building ? "#a78bfa" : active ? "#6ef2c0" : fused ? "#7c3aed" : "#2b3d63", scale: 1 }}
              strokeWidth={1.8} style={{ transformOrigin: `${p.x}px ${p.y}px` }} transition={{ type: "spring", stiffness: 200, damping: 14 }} />
            <text x={p.x} y={p.y + 1} textAnchor="middle" className="fill-text font-sans text-[14px] font-semibold">{sys.name.replace("_fused", "")}</text>
            <text x={p.x} y={p.y + 16} textAnchor="middle" className="font-mono text-[9.5px]" fill={fused ? "#c4b5fd" : "#8392b0"}>
              {sys.mode === "hosted" ? "synapse hosted" : fused ? "fused · custom" : "synapse local"}
            </text>
            <AnimatePresence>
              {building && (
                <motion.text key="b" x={p.x} y={p.y - 52} textAnchor="middle" className="font-mono text-[11px]" fill="#c4b5fd"
                  initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                  synapse build…
                </motion.text>
              )}
            </AnimatePresence>
          </g>
        );
      })}

      {/* agent core */}
      <motion.circle cx={C.x} cy={C.y} r={70} fill="url(#core)" filter="url(#glow)"
        animate={{ opacity: s.busy ? [0.25, 0.55, 0.25] : [0.18, 0.3, 0.18], r: s.busy ? [66, 80, 66] : [66, 72, 66] }}
        transition={{ duration: s.busy ? 1.1 : 3.2, repeat: Infinity }} />
      <circle cx={C.x} cy={C.y} r={46} fill="url(#core)" />
      <text x={C.x} y={C.y - 3} textAnchor="middle" className="fill-white font-display text-[15px] font-bold tracking-wide">AGENT</text>
      <motion.text key={s.live.length} x={C.x} y={C.y + 15} textAnchor="middle" className="font-mono text-[11px]" fill="#efeaff"
        initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
        {s.live.length} {s.live.length === 1 ? "tool" : "tools"}
      </motion.text>
    </svg>
  );
}

/** A white signal that travels to the endpoint and back along the grafted link. */
function PulseDot({ id, pathId, onDone }: { id: number; pathId: string; onDone: (id: number) => void }) {
  const ref = useRef<SVGCircleElement>(null);
  useEffect(() => {
    const path = document.getElementById(pathId) as SVGPathElement | null;
    const dot = ref.current;
    if (!path || !dot) { const t = setTimeout(() => onDone(id), 50); return () => clearTimeout(t); }
    const len = path.getTotalLength(), t0 = performance.now(), dur = 900;
    let raf = 0;
    const step = (t: number) => {
      const f = Math.min((t - t0) / dur, 1), u = f < 0.5 ? f * 2 : (1 - f) * 2;
      const pt = path.getPointAtLength(len * u);
      dot.setAttribute("cx", String(pt.x)); dot.setAttribute("cy", String(pt.y));
      if (f < 1) raf = requestAnimationFrame(step); else onDone(id);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [id, pathId, onDone]);
  return <circle ref={ref} r={5} fill="#fff" filter="url(#glow)" cx={-20} cy={-20} />;
}
