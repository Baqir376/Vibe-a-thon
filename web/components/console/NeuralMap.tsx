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
        <radialGradient id="core"><stop offset="0%" stopColor="#ffb089" /><stop offset="55%" stopColor="#e8551f" /><stop offset="100%" stopColor="#4a1806" /></radialGradient>
        <radialGradient id="sys"><stop offset="0%" stopColor="#2a241c" /><stop offset="100%" stopColor="#15120e" /></radialGradient>
        <filter id="glow" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="4" result="b" /><feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge></filter>
      </defs>

      {/* dendrites */}
      {s.systems.map((sys) => pos[sys.name] && (
        <motion.path key={sys.name} d={dendrite(pos[sys.name].x, pos[sys.name].y)} fill="none" stroke="#4a3f33" strokeWidth={1.6} strokeLinecap="round"
          initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 1.4, ease: [0.22, 1, 0.36, 1] }} />
      ))}
      {eps.map((e) => (
        <line key={"d" + e.k} x1={pos[e.sys].x} y1={pos[e.sys].y} x2={e.x} y2={e.y} stroke="#2a251e" />
      ))}

      {/* grafted (live) and dormant links */}
      {linked.map((e) => {
        const live = s.live.includes(e.k);
        const color = e.sys.endsWith("_fused") ? "#ff7a45" : e.cap.mutating ? "#f2c14e" : "#8fd18a";
        const d = linkD(pos[e.sys].x, pos[e.sys].y, e.x, e.y);
        return (
          <g key={"l" + e.k}>
            {/* solid stroke draws itself in; pathLength owns its dasharray */}
            <motion.path id={"path-" + e.k} d={d} fill="none"
              initial={{ pathLength: 0, opacity: 0 }}
              animate={{ pathLength: 1, opacity: live ? 0.95 : 0.3, stroke: live ? color : "#5a5043", strokeWidth: live ? 2.4 : 1.2 }}
              transition={{ pathLength: { duration: 0.9, ease: [0.22, 1, 0.36, 1] }, default: { duration: 0.5 } }}
              filter={live ? "url(#glow)" : undefined} />
            {/* dashed overlay: flowing signal when live, dotted when dormant */}
            <motion.path d={d} fill="none" strokeDasharray={live ? "5 11" : "3 7"} className={live ? "link-flow" : ""}
              initial={{ opacity: 0 }} animate={{ opacity: 1, stroke: live ? "#fff1e4" : "#5a5043", strokeWidth: live ? 2.2 : 1.2 }}
              transition={{ duration: 0.4, delay: live ? 0.7 : 0 }} />
          </g>
        );
      })}

      {/* a spark burst each time an endpoint is grafted */}
      {eps.filter((e) => s.live.includes(e.k)).map((e) => <Spark key={"s" + e.k} x={e.x} y={e.y} color={e.sys.endsWith("_fused") ? "#ff7a45" : e.cap.mutating ? "#f2c14e" : "#8fd18a"} />)}

      {/* signal pulses for tool calls */}
      {s.pulses.map((p) => <PulseDot key={p.id} id={p.id} pathId={"path-" + p.key} onDone={onPulseDone} />)}

      {/* endpoints */}
      {eps.map((e) => {
        const live = s.live.includes(e.k), dormant = s.dormant.includes(e.k), fresh = s.fresh.includes(e.k);
        const fused = e.sys.endsWith("_fused");
        const base = fused ? "#ff7a45" : e.cap.mutating ? "#f2c14e" : "#7d95ff";
        const showLabel = live || fresh || fused || hoverSys === e.sys;
        const right = Math.cos((e.ang * Math.PI) / 180) >= 0;
        return (
          <g key={"e" + e.k}>
            <motion.circle cx={e.x} cy={e.y}
              initial={fresh ? { r: 0 } : false}
              animate={{ r: live ? 7.5 : fresh ? 8 : fused ? 7 : 5,
                         fill: live ? (fused ? "#ff7a45" : e.cap.mutating ? "#f2c14e" : "#8fd18a") : dormant ? "rgba(0,0,0,0)" : fresh ? "#ffd166" : base,
                         opacity: live || fresh || fused ? 1 : dormant ? 0.9 : 0.32,
                         stroke: dormant && !live ? "#5a5043" : "rgba(0,0,0,0)" }}
              strokeWidth={1.6} transition={{ type: "spring", stiffness: 260, damping: 16 }}
              filter={live || fresh ? "url(#glow)" : undefined}>
              <title>{`${e.sys} · ${e.cap.spec}\n${e.cap.description}`}</title>
            </motion.circle>
            {fresh && (
              <motion.circle cx={e.x} cy={e.y} r={8} fill="none" stroke="#ffd166"
                animate={{ r: [8, 26], opacity: [0.9, 0] }} transition={{ duration: 1.6, repeat: Infinity }} />
            )}
            <AnimatePresence>
              {showLabel && (
                <motion.text initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                  x={e.x + (right ? 12 : -12)} y={e.y + 3.5} textAnchor={right ? "start" : "end"}
                  className="font-mono text-[10.5px]" fill={fresh ? "#ffd166" : live ? "#f1eadc" : "#a39887"}>
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
              <motion.circle key={d} cx={p.x} cy={p.y} r={38} fill="none" stroke="#ff7a45" strokeWidth={2}
                animate={{ r: [38, 92], opacity: [0.9, 0] }} transition={{ duration: 1.2, repeat: Infinity, delay: d }} />
            ))}
            <motion.circle cx={p.x} cy={p.y} r={38} fill="url(#sys)"
              initial={fused ? { scale: 0 } : false}
              animate={{ stroke: building ? "#ff7a45" : active ? "#8fd18a" : fused ? "#e8551f" : "#4a4033", scale: 1 }}
              strokeWidth={1.8} style={{ transformOrigin: `${p.x}px ${p.y}px` }} transition={{ type: "spring", stiffness: 200, damping: 14 }} />
            <text x={p.x} y={p.y + 1} textAnchor="middle" className="fill-text font-sans text-[14px] font-semibold">{sys.name.replace("_fused", "")}</text>
            <text x={p.x} y={p.y + 16} textAnchor="middle" className="font-mono text-[9.5px]" fill={fused ? "#ffb089" : "#a39887"}>
              {sys.mode === "hosted" ? "synapse hosted" : fused ? "fused · custom" : "synapse local"}
            </text>
            <AnimatePresence>
              {building && (
                <motion.text key="b" x={p.x} y={p.y - 52} textAnchor="middle" className="font-mono text-[11px]" fill="#ffb089"
                  initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                  synapse build…
                </motion.text>
              )}
            </AnimatePresence>
          </g>
        );
      })}

      {/* agent core: orbiting rings, faster while it works */}
      {[{ r: 92, dash: "2 10", dur: 40, dir: 1 }, { r: 112, dash: "28 14 4 14", dur: 60, dir: -1 }].map((o) => (
        <motion.circle key={o.r} cx={C.x} cy={C.y} r={o.r} fill="none" stroke="#ff7a45" strokeOpacity={s.busy ? 0.55 : 0.22} strokeWidth={1.2}
          strokeDasharray={o.dash} style={{ transformOrigin: `${C.x}px ${C.y}px` }}
          animate={{ rotate: 360 * o.dir }} transition={{ duration: s.busy ? o.dur / 5 : o.dur, repeat: Infinity, ease: "linear" }} />
      ))}
      {s.busy && <motion.circle cx={C.x + 92} cy={C.y} r={4} fill="#ffb089" style={{ transformOrigin: `${C.x}px ${C.y}px` }} filter="url(#glow)"
        animate={{ rotate: 360 }} transition={{ duration: 2.2, repeat: Infinity, ease: "linear" }} />}
      {/* agent core */}
      <motion.circle cx={C.x} cy={C.y} r={70} fill="url(#core)" filter="url(#glow)"
        animate={{ opacity: s.busy ? [0.25, 0.55, 0.25] : [0.18, 0.3, 0.18], r: s.busy ? [66, 80, 66] : [66, 72, 66] }}
        transition={{ duration: s.busy ? 1.1 : 3.2, repeat: Infinity }} />
      <circle cx={C.x} cy={C.y} r={46} fill="url(#core)" />
      <text x={C.x} y={C.y - 3} textAnchor="middle" className="fill-white font-display text-[15px] font-bold tracking-wide">AGENT</text>
      <motion.text key={s.live.length} x={C.x} y={C.y + 15} textAnchor="middle" className="font-mono text-[11px]" fill="#ffe9dc"
        initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
        {s.live.length} {s.live.length === 1 ? "tool" : "tools"}
      </motion.text>
    </svg>
  );
}

/** Slightly wavy, hand-drawn looking dendrite from the core to a system. */
function dendrite(x: number, y: number) {
  const mx = (C.x + x) / 2, my = (C.y + y) / 2, dx = x - C.x, dy = y - C.y, n = Math.hypot(dx, dy) || 1;
  const off = 0.14 * n;
  const q1 = { x: C.x + dx * 0.3 - (dy / n) * off, y: C.y + dy * 0.3 + (dx / n) * off };
  const q2 = { x: C.x + dx * 0.72 + (dy / n) * off * 0.7, y: C.y + dy * 0.72 - (dx / n) * off * 0.7 };
  return `M ${C.x} ${C.y} Q ${q1.x} ${q1.y} ${mx} ${my} Q ${q2.x} ${q2.y} ${x} ${y}`;
}

/** One-shot burst: a ring and eight sparks flying out. */
function Spark({ x, y, color }: { x: number; y: number; color: string }) {
  return (
    <g pointerEvents="none">
      <motion.circle cx={x} cy={y} fill="none" stroke={color} strokeWidth={2} initial={{ r: 6, opacity: 0.9 }} animate={{ r: 34, opacity: 0 }} transition={{ duration: 0.8, ease: "easeOut" }} />
      {Array.from({ length: 8 }, (_, i) => {
        const a = (i / 8) * Math.PI * 2;
        return <motion.circle key={i} r={2.2} fill={color} initial={{ cx: x, cy: y, opacity: 1 }}
          animate={{ cx: x + Math.cos(a) * 30, cy: y + Math.sin(a) * 30, opacity: 0 }} transition={{ duration: 0.7, ease: "easeOut" }} />;
      })}
    </g>
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
