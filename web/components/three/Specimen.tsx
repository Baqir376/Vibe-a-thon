"use client";

import { ContactShadows, Float } from "@react-three/drei";
import { Canvas, useFrame } from "@react-three/fiber";
import { useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";

/**
 * "Fig. 1": a 3D specimen neuron in ceramic and ink. Four legacy systems sit around it;
 * on a loop the agent grafts two of them (orange axons grow out, signals travel), then prunes.
 */
const SYSTEMS = [
  { name: "orders", color: "#2346d8", pos: new THREE.Vector3(-2.3, 1.15, 0.2) },
  { name: "inventory", color: "#3e7c4f", pos: new THREE.Vector3(2.35, 1.05, -0.3) },
  { name: "tickets", color: "#b07d12", pos: new THREE.Vector3(2.1, -1.25, 0.5) },
  { name: "roster", color: "#7a3fb0", pos: new THREE.Vector3(-2.15, -1.2, -0.2) },
];
const CYCLE = 6;

function rng(seed: number) { return () => ((seed = (seed * 16807) % 2147483647) - 1) / 2147483646; }

/** Inked dendrite tree around the soma, as tube geometries (seeded so it is the same every load). */
function useDendrites() {
  return useMemo(() => {
    const r = rng(7);
    const tubes: THREE.TubeGeometry[] = [];
    const branch = (start: THREE.Vector3, dir: THREE.Vector3, len: number, rad: number, depth: number) => {
      const pts = [start.clone()];
      const d = dir.clone();
      let p = start.clone();
      for (let i = 0; i < 5; i++) {
        d.add(new THREE.Vector3(r() - 0.5, r() - 0.5, r() - 0.5).multiplyScalar(0.5)).normalize();
        p = p.clone().add(d.clone().multiplyScalar(len / 5));
        pts.push(p);
      }
      tubes.push(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 24, rad, 6, false));
      if (depth > 0) for (let f = 0; f < 2; f++) {
        const nd = d.clone().add(new THREE.Vector3(r() - 0.5, r() - 0.5, r() - 0.5).multiplyScalar(1.1)).normalize();
        branch(pts[3 + (f % 2)], nd, len * 0.6, rad * 0.62, depth - 1);
      }
    };
    for (let i = 0; i < 7; i++) {
      const dir = new THREE.Vector3(r() - 0.5, r() - 0.5, (r() - 0.5) * 0.7).normalize();
      branch(dir.clone().multiplyScalar(0.55), dir, 0.9 + r() * 0.5, 0.045, 2);
    }
    return tubes;
  }, []);
}

/** Label chip drawn on a canvas: no DOM, no extra React roots (drei <Html> crashes under React 19 here). */
function chip(text: string, on: boolean) {
  const c = document.createElement("canvas");
  const g = c.getContext("2d")!;
  const font = "600 30px ui-monospace, 'JetBrains Mono', monospace";
  g.font = font;
  const w = Math.ceil(g.measureText(text).width) + 28;
  c.width = w; c.height = 50;
  g.font = font;
  g.fillStyle = on ? "#e8551f" : "#f8f4ec";
  g.strokeStyle = on ? "#e8551f" : "#16130f";
  g.lineWidth = 3;
  g.beginPath(); g.roundRect(2, 2, w - 4, 46, 9); g.fill(); g.stroke();
  g.fillStyle = on ? "#ffffff" : "#16130f";
  g.textBaseline = "middle";
  g.fillText(text, 14, 26);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return { tex: t, aspect: w / 50 };
}

function Label({ name, index, at, loop }: { name: string; index: number; at: THREE.Vector3; loop: React.MutableRefObject<{ chosen: number[]; phase: number }> }) {
  const off = useMemo(() => chip(name, false), [name]);
  const on = useMemo(() => chip(`grafted · ${name}`, true), [name]);
  const sprite = useRef<THREE.Sprite>(null);
  useFrame(() => {
    const { chosen, phase } = loop.current;
    const lit = chosen.includes(index) && phase > 0.6 && phase < 5.8;
    const cur = lit ? on : off;
    const s = sprite.current;
    if (!s) return;
    const mat = s.material as THREE.SpriteMaterial;
    if (mat.map !== cur.tex) { mat.map = cur.tex; mat.needsUpdate = true; }
    s.scale.set(0.3 * cur.aspect, 0.3, 1);
  });
  return (
    <sprite ref={sprite} position={[at.x, at.y + 0.45, at.z]}>
      <spriteMaterial map={off.tex} transparent depthTest={false} />
    </sprite>
  );
}

function Graft({ target, color, index, loop }: { target: THREE.Vector3; color: string; index: number; loop: React.MutableRefObject<{ chosen: number[]; phase: number }> }) {
  const geo = useMemo(() => {
    const mid = target.clone().multiplyScalar(0.5).add(new THREE.Vector3(0, 0.5, 0.4));
    return new THREE.TubeGeometry(new THREE.QuadraticBezierCurve3(new THREE.Vector3(), mid, target), 64, 0.03, 8, false);
  }, [target]);
  const curve = useMemo(() => new THREE.QuadraticBezierCurve3(new THREE.Vector3(), target.clone().multiplyScalar(0.5).add(new THREE.Vector3(0, 0.5, 0.4)), target), [target]);
  const pulse = useRef<THREE.Mesh>(null);
  const ring = useRef<THREE.Mesh>(null);
  useFrame(() => {
    const { chosen, phase } = loop.current;
    const active = chosen.includes(index);
    if (ring.current) ring.current.visible = active && phase < 6.4;
    const grow = !active ? 0 : phase < 1.4 ? phase / 1.4 : phase < 5.2 ? 1 : phase < 6.4 ? 1 - (phase - 5.2) / 1.2 : 0;
    const idx = geo.index!.count;
    geo.setDrawRange(0, Math.floor(idx * grow / 6) * 6);
    if (pulse.current) {
      const using = active && phase > 1.4 && phase < 5.2;
      pulse.current.visible = using;
      if (using) { const u = ((phase - 1.4) * 0.8) % 1; pulse.current.position.copy(curve.getPoint(u < 0.5 ? u * 2 : (1 - u) * 2)); }
    }
  });
  return (
    <group>
      <mesh geometry={geo}><meshStandardMaterial color="#e8551f" emissive="#e8551f" emissiveIntensity={0.9} roughness={0.4} /></mesh>
      <mesh ref={pulse} visible={false}><sphereGeometry args={[0.085, 16, 16]} /><meshBasicMaterial color="#ff8a4f" toneMapped={false} /></mesh>
      <mesh ref={ring} position={target} visible={false}><torusGeometry args={[0.32, 0.018, 8, 48]} /><meshBasicMaterial color={color} /></mesh>
    </group>
  );
}

function Scene({ kick }: { kick: React.MutableRefObject<number> }) {
  const group = useRef<THREE.Group>(null);
  const soma = useRef<THREE.MeshStandardMaterial>(null);
  const tubes = useDendrites();
  const loop = useRef({ chosen: [0, 2], phase: 0 });
  useFrame((s) => {
    const t = s.clock.elapsedTime;
    if (group.current) {
      group.current.rotation.y = THREE.MathUtils.lerp(group.current.rotation.y, s.pointer.x * 0.5 + Math.sin(t * 0.2) * 0.15, 0.05);
      group.current.rotation.x = THREE.MathUtils.lerp(group.current.rotation.x, -s.pointer.y * 0.25, 0.05);
    }
    const k = Math.max(0, 1 - (t - kick.current) * 1.5);
    if (soma.current) soma.current.emissiveIntensity = 0.05 + k * 1.4;
    const cyc = Math.floor(t / CYCLE);
    loop.current = { chosen: [cyc % 4, (cyc + 2) % 4], phase: t % CYCLE };
  });
  return (
    <group ref={group}>
      <mesh>
        <sphereGeometry args={[0.6, 64, 64]} />
        <meshStandardMaterial ref={soma} color="#efe5d2" roughness={0.55} emissive="#e8551f" emissiveIntensity={0.05} />
      </mesh>
      <mesh scale={0.24} position={[0.12, 0.08, 0.5]}><sphereGeometry args={[1, 32, 32]} /><meshStandardMaterial color="#2a2118" roughness={0.6} /></mesh>
      {tubes.map((g, i) => <mesh key={i} geometry={g}><meshStandardMaterial color="#231d16" roughness={0.75} /></mesh>)}
      {SYSTEMS.map((sys, i) => (
        <group key={sys.name}>
          <Graft target={sys.pos} color={sys.color} index={i} loop={loop} />
          <mesh position={sys.pos}>
            <sphereGeometry args={[0.2, 48, 48]} />
            <meshPhysicalMaterial color={sys.color} roughness={0.18} clearcoat={1} clearcoatRoughness={0.1} />
          </mesh>
          <Label name={sys.name} index={i} at={sys.pos} loop={loop} />
        </group>
      ))}
    </group>
  );
}

export default function Specimen() {
  const wrap = useRef<HTMLDivElement>(null);
  const kick = useRef(-10);
  const [visible, setVisible] = useState(true);
  useEffect(() => {
    const io = new IntersectionObserver(([e]) => setVisible(e.isIntersecting), { rootMargin: "100px" });
    if (wrap.current) io.observe(wrap.current);
    return () => io.disconnect();
  }, []);
  return (
    <div ref={wrap} className="absolute inset-0" data-cursor="Poke">
      <Canvas data-three dpr={[1, 1.75]} camera={{ position: [0, 0.2, 9.3], fov: 40 }} gl={{ antialias: true, alpha: true }}
        frameloop={visible ? "always" : "never"}
        onCreated={({ clock }) => wrap.current?.addEventListener("pointerdown", () => { kick.current = clock.elapsedTime; })}>
        <ambientLight intensity={1.1} />
        <directionalLight position={[3, 5, 4]} intensity={2.2} />
        <directionalLight position={[-4, -2, 2]} intensity={0.6} color="#ffd9c2" />
        <Float speed={1.1} rotationIntensity={0.2} floatIntensity={0.45}><Scene kick={kick} /></Float>
        <ContactShadows position={[0, -2.1, 0]} opacity={0.32} scale={9} blur={2.6} far={4} color="#16130f" />
      </Canvas>
    </div>
  );
}
