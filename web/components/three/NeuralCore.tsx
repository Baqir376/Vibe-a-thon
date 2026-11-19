"use client";

import { Environment, Float, Html, Lightformer, MeshTransmissionMaterial, QuadraticBezierLine, Sparkles } from "@react-three/drei";
import { Canvas, useFrame } from "@react-three/fiber";
import { useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";

// The four legacy systems orbit the agent; dendrites grow to the ones a "question" needs.
const SYSTEMS = [
  { name: "orders", color: "#38d6f5", radius: 2.55, tilt: 0.35, speed: 0.16, phase: 0 },
  { name: "inventory", color: "#6ef2c0", radius: 2.9, tilt: -0.5, speed: 0.12, phase: 1.6 },
  { name: "tickets", color: "#ffb547", radius: 2.4, tilt: 0.9, speed: 0.19, phase: 3.1 },
  { name: "roster", color: "#c4b5fd", radius: 2.75, tilt: -0.15, speed: 0.14, phase: 4.6 },
];
const CYCLE = 7.5; // seconds: grow (0-1.4) · use (1.4-5.2) · prune (5.2-6.4) · rest

function glowTexture() {
  const c = document.createElement("canvas");
  c.width = c.height = 128;
  const g = c.getContext("2d")!;
  const grd = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  grd.addColorStop(0, "rgba(255,255,255,1)");
  grd.addColorStop(0.25, "rgba(255,255,255,.45)");
  grd.addColorStop(1, "rgba(255,255,255,0)");
  g.fillStyle = grd;
  g.fillRect(0, 0, 128, 128);
  return new THREE.CanvasTexture(c);
}

function orbitPos(s: (typeof SYSTEMS)[number], t: number, out: THREE.Vector3) {
  const a = s.phase + t * s.speed;
  out.set(Math.cos(a) * s.radius, Math.sin(a) * s.radius * 0.42, Math.sin(a) * s.radius * 0.8);
  out.applyAxisAngle(new THREE.Vector3(1, 0, 0), s.tilt * 0.35);
  return out;
}

function Scene({ kick }: { kick: React.MutableRefObject<number> }) {
  const group = useRef<THREE.Group>(null);
  const core = useRef<THREE.Mesh>(null);
  const coreMat = useRef<THREE.MeshStandardMaterial>(null);
  const nodes = useRef<(THREE.Group | null)[]>([]);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- drei Line2 ref exposes setPoints
  const lines = useRef<(any | null)[]>([]);
  const pulses = useRef<(THREE.Sprite | null)[]>([]);
  const tex = useMemo(() => glowTexture(), []);
  const tmp = useMemo(() => new THREE.Vector3(), []);
  const chosen = useRef<number[]>([0, 2]);
  const lastCycle = useRef(-1);
  const [labels, setLabels] = useState<number[]>([]);

  useFrame((state, dt) => {
    const t = state.clock.elapsedTime;
    // tilt toward the cursor, slow auto-rotation
    if (group.current) {
      group.current.rotation.y = THREE.MathUtils.lerp(group.current.rotation.y, state.pointer.x * 0.45 + t * 0.05, 0.05);
      group.current.rotation.x = THREE.MathUtils.lerp(group.current.rotation.x, -state.pointer.y * 0.3, 0.05);
    }
    // click flash + heartbeat
    const k = Math.max(0, 1 - (t - kick.current) * 1.6);
    if (core.current) core.current.scale.setScalar(1 + Math.sin(t * 2.2) * 0.03 + k * 0.25);
    if (coreMat.current) coreMat.current.emissiveIntensity = 2.2 + Math.sin(t * 2.2) * 0.4 + k * 4;

    const cyc = Math.floor(t / CYCLE), ph = t % CYCLE;
    if (cyc !== lastCycle.current) {
      lastCycle.current = cyc;
      const a = cyc % SYSTEMS.length, b = (cyc + 2) % SYSTEMS.length;
      chosen.current = [a, b];
    }
    const grow = ph < 1.4 ? ph / 1.4 : ph < 5.2 ? 1 : ph < 6.4 ? 1 - (ph - 5.2) / 1.2 : 0;
    const ease = grow * grow * (3 - 2 * grow);

    SYSTEMS.forEach((s, i) => {
      orbitPos(s, t, tmp);
      const n = nodes.current[i];
      if (n) { n.position.copy(tmp); n.rotation.y += dt * 0.8; }
      const active = chosen.current.includes(i);
      const line = lines.current[i];
      if (line) {
        const end = tmp.clone().multiplyScalar(active ? ease : 0.0001);
        const mid = end.clone().multiplyScalar(0.5).add(new THREE.Vector3(0, 0.6 * (active ? ease : 0), 0));
        line.setPoints([0, 0, 0], end, mid);
        line.material.opacity = active ? 0.25 + 0.75 * ease : 0;
      }
      const p = pulses.current[i];
      if (p) {
        const using = active && ph > 1.4 && ph < 5.2;
        p.visible = using;
        if (using) {
          const u = ((ph - 1.4) * 0.9 + i * 0.3) % 1;
          const tt = u < 0.5 ? u * 2 : (1 - u) * 2;
          const mid = tmp.clone().multiplyScalar(0.5).add(new THREE.Vector3(0, 0.6, 0));
          const curve = new THREE.QuadraticBezierCurve3(new THREE.Vector3(), mid, tmp.clone());
          p.position.copy(curve.getPoint(tt));
        }
      }
    });
    const want = ph > 1.0 && ph < 5.6 ? chosen.current : [];
    if (want.join() !== labels.join()) setLabels(want);
  });

  return (
    <group ref={group}>
      {/* glass shell */}
      <mesh>
        <sphereGeometry args={[1.12, 64, 64]} />
        <MeshTransmissionMaterial samples={6} resolution={512} thickness={0.6} roughness={0.08} transmission={1} ior={1.25}
          chromaticAberration={0.45} anisotropy={0.2} distortion={0.25} distortionScale={0.4} temporalDistortion={0.12}
          color="#d9ccff" backside />
      </mesh>
      {/* glowing heart */}
      <mesh ref={core}>
        <icosahedronGeometry args={[0.42, 2]} />
        <meshStandardMaterial ref={coreMat} color="#7c3aed" emissive="#a78bfa" emissiveIntensity={2.4} roughness={0.3} toneMapped={false} />
      </mesh>
      <sprite scale={2.6}><spriteMaterial map={tex} color="#8b5cf6" transparent opacity={0.55} depthWrite={false} blending={THREE.AdditiveBlending} /></sprite>

      {SYSTEMS.map((s, i) => (
        <group key={s.name}>
          <QuadraticBezierLine ref={(r) => { lines.current[i] = r; }} start={[0, 0, 0]} end={[0, 0, 0.001]} lineWidth={2.2}
            color={s.color} transparent opacity={0} toneMapped={false} />
          <sprite ref={(r) => { pulses.current[i] = r; }} scale={0.32} visible={false}>
            <spriteMaterial map={tex} color="#ffffff" transparent depthWrite={false} blending={THREE.AdditiveBlending} />
          </sprite>
          <group ref={(r) => { nodes.current[i] = r; }}>
            <mesh>
              <icosahedronGeometry args={[0.2, 1]} />
              <meshStandardMaterial color={s.color} emissive={s.color} emissiveIntensity={1.6} toneMapped={false} flatShading />
            </mesh>
            <sprite scale={0.95}><spriteMaterial map={tex} color={s.color} transparent opacity={0.5} depthWrite={false} blending={THREE.AdditiveBlending} /></sprite>
            {[0, 1, 2].map((j) => (
              <mesh key={j} position={[Math.cos(j * 2.1) * 0.42, Math.sin(j * 2.1) * 0.42, Math.sin(j * 1.3) * 0.2]}>
                <sphereGeometry args={[0.045, 12, 12]} />
                <meshBasicMaterial color={s.color} toneMapped={false} />
              </mesh>
            ))}
            {labels.includes(i) && (
              <Html center distanceFactor={9} position={[0, 0.48, 0]} zIndexRange={[10, 0]}>
                <span className="rounded-full border border-white/15 bg-black/50 px-2 py-0.5 font-mono text-[10px] whitespace-nowrap text-white backdrop-blur">
                  ⟡ graft {s.name}
                </span>
              </Html>
            )}
          </group>
        </group>
      ))}
      <Sparkles count={70} scale={[9, 6, 6]} size={2.2} speed={0.25} opacity={0.5} color="#c4b5fd" />
    </group>
  );
}

export default function NeuralCore() {
  const wrap = useRef<HTMLDivElement>(null);
  const kick = useRef(-10);
  const [visible, setVisible] = useState(true);
  const [reduce, setReduce] = useState(false);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- matchMedia only exists after mount
    setReduce(window.matchMedia("(prefers-reduced-motion: reduce)").matches);
    const io = new IntersectionObserver(([e]) => setVisible(e.isIntersecting), { rootMargin: "100px" });
    if (wrap.current) io.observe(wrap.current);
    return () => io.disconnect();
  }, []);
  return (
    <div ref={wrap} className="absolute inset-0" data-cursor="Click">
      <Canvas dpr={[1, 1.75]} camera={{ position: [0, 0, 9.4], fov: 38 }} gl={{ antialias: true, alpha: true, powerPreference: "high-performance" }}
        frameloop={reduce ? "demand" : visible ? "always" : "never"}
        onCreated={({ clock }) => { const onDown = () => { kick.current = clock.elapsedTime; }; wrap.current?.addEventListener("pointerdown", onDown); }}>
        <ambientLight intensity={0.35} />
        <pointLight position={[0, 0, 0]} intensity={18} color="#a78bfa" distance={6} />
        <directionalLight position={[4, 5, 3]} intensity={1.2} />
        <Float speed={1.2} rotationIntensity={0.25} floatIntensity={0.5}>
          <Scene kick={kick} />
        </Float>
        <Environment resolution={256} frames={1}>
          <Lightformer form="ring" intensity={3} color="#a78bfa" position={[0, 3, -6]} scale={6} />
          <Lightformer form="rect" intensity={2.5} color="#38d6f5" position={[-5, 0, -2]} rotation-y={Math.PI / 2} scale={[8, 2, 1]} />
          <Lightformer form="rect" intensity={2} color="#6ef2c0" position={[5, -1, -2]} rotation-y={-Math.PI / 2} scale={[8, 2, 1]} />
          <Lightformer form="circle" intensity={4} color="#ffffff" position={[0, 0, 6]} scale={2} />
        </Environment>
      </Canvas>
    </div>
  );
}
