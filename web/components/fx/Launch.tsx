"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "motion/react";
import { useEffect, useState, type ComponentProps } from "react";
import { createPortal } from "react-dom";

const KEY = "synapto-launch";

/** "Launch app": ink floods out from the click point, then the workspace opens like an iris. */
export function LaunchLink({ children, onClick, ...rest }: Omit<ComponentProps<typeof Link>, "href">) {
  const router = useRouter();
  const [at, setAt] = useState<{ x: number; y: number } | null>(null);
  useEffect(() => { router.prefetch("/app"); }, [router]);

  return (
    <>
      <Link {...rest} href="/app" onClick={(e) => {
        onClick?.(e);
        if (e.defaultPrevented || e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return;
        if (matchMedia("(prefers-reduced-motion: reduce)").matches) return; // plain navigation
        e.preventDefault();
        try { sessionStorage.setItem(KEY, "1"); } catch { /* ignore */ }
        setAt({ x: e.clientX || innerWidth / 2, y: e.clientY || innerHeight / 2 });
        setTimeout(() => router.push("/app"), 820);
      }}>{children}</Link>
      {at && typeof document !== "undefined" && createPortal(<InkFlood x={at.x} y={at.y} />, document.body)}
    </>
  );
}

function InkFlood({ x, y }: { x: number; y: number }) {
  return (
    <motion.div aria-hidden className="pointer-events-none fixed inset-0 z-[200] bg-ink"
      initial={{ clipPath: `circle(0px at ${x}px ${y}px)` }} animate={{ clipPath: `circle(150vmax at ${x}px ${y}px)` }}
      transition={{ duration: 0.8, ease: [0.7, 0, 0.2, 1] }}>
      <WakeMark />
    </motion.div>
  );
}

/** Centred mark shown while the page changes: a neuron draws itself, soma glowing. */
function WakeMark() {
  const d = ["M60 60 C 40 40, 30 30, 12 22", "M60 60 C 82 38, 92 30, 110 26", "M60 60 C 36 76, 26 92, 18 108", "M60 60 C 84 80, 96 92, 106 110", "M60 60 C 62 30, 58 18, 62 4"];
  return (
    <div className="absolute inset-0 flex flex-col items-center justify-center gap-5">
      <svg viewBox="0 0 120 120" className="h-28 w-28">
        {d.map((p, i) => (
          <motion.path key={i} d={p} fill="none" stroke="#f1eadc" strokeWidth={2.2} strokeLinecap="round"
            initial={{ pathLength: 0, opacity: 0.2 }} animate={{ pathLength: 1, opacity: 0.85 }} transition={{ delay: 0.12 + i * 0.05, duration: 0.5 }} />
        ))}
        <motion.circle cx={60} cy={60} r={9} fill="#ff7a45" initial={{ scale: 0 }} animate={{ scale: [0, 1.3, 1] }} transition={{ delay: 0.12, duration: 0.5 }}
          style={{ filter: "drop-shadow(0 0 14px #ff7a45)" }} />
      </svg>
      <motion.p className="font-hand text-2xl text-[#f1eadc]/80" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.45 }}>
        waking the agent…
      </motion.p>
    </div>
  );
}

/** Rendered by /app. Visible from first paint only when arriving via LaunchLink (html.launching, set in <head>). */
export function LaunchReveal() {
  const [open, setOpen] = useState(false);
  const [gone, setGone] = useState(false);
  useEffect(() => {
    const html = document.documentElement;
    try { sessionStorage.removeItem(KEY); } catch { /* ignore */ }
    if (!html.classList.contains("launching")) { setGone(true); return; } // eslint-disable-line react-hooks/set-state-in-effect -- reads a class set before hydration
    const t1 = setTimeout(() => setOpen(true), 450);
    const t2 = setTimeout(() => { setGone(true); html.classList.remove("launching"); }, 1600);
    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, []);
  return (
    <AnimatePresence>
      {!gone && (
        <motion.div aria-hidden className="launch-overlay pointer-events-none fixed inset-0 z-[200] bg-ink"
          initial={false} animate={{ clipPath: open ? "circle(0% at 50% 50%)" : "circle(150% at 50% 50%)" }}
          transition={{ duration: 1, ease: [0.7, 0, 0.2, 1] }}>
          <motion.div animate={{ opacity: open ? 0 : 1, scale: open ? 1.4 : 1 }} transition={{ duration: 0.5 }} className="absolute inset-0">
            <WakeMark />
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
