"use client";

import dynamic from "next/dynamic";

/** CSS stand-in shown while the 3D scene loads (and if WebGL is unavailable). */
function Poster() {
  return (
    <div className="absolute inset-0 flex items-center justify-center" aria-hidden>
      <div className="relative h-56 w-56 rounded-full bg-[radial-gradient(circle_at_35%_30%,#e9e2ff_0%,#a78bfa_22%,#5b21b6_55%,#1e1040_80%)] opacity-80 shadow-[0_0_120px_rgba(139,92,246,.55)]">
        <div className="absolute inset-[38%] rounded-full bg-violet blur-md" />
      </div>
    </div>
  );
}

// Loaded after first paint, client-only: the page never waits on three.js.
const NeuralCore = dynamic(() => import("./NeuralCore"), { ssr: false, loading: Poster });

export function HeroCore() {
  return (
    <div className="relative aspect-square w-full">
      <NeuralCore />
    </div>
  );
}
