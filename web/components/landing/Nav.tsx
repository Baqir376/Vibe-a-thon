"use client";

import { LaunchLink } from "@/components/fx/Launch";
import Link from "next/link";
import { motion, useMotionValueEvent, useScroll } from "motion/react";
import { useState } from "react";
import { InkMark } from "@/components/Logo";
import { Magnetic } from "@/components/fx/Interactions";

export function Nav() {
  const { scrollY } = useScroll();
  const [scrolled, setScrolled] = useState(false);
  useMotionValueEvent(scrollY, "change", (v) => setScrolled(v > 24));
  return (
    <motion.nav initial={{ y: -40, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.2, duration: 0.6 }}
      className="fixed inset-x-0 top-4 z-50 flex justify-center px-4">
      <div className={`flex w-full max-w-5xl items-center justify-between rounded-full px-4 py-2 transition-all duration-500 ${scrolled ? "border-[1.5px] border-carbon bg-paper/90 shadow-[3px_3px_0_#16130f] backdrop-blur" : "border-[1.5px] border-transparent"}`}>
        <Link href="/" className="flex items-center gap-2 text-carbon" data-cursor="Home">
          <InkMark size={26} />
          <span className="font-display text-[19px] font-semibold tracking-tight">Synapto<i className="text-signal-ink">genesis</i></span>
        </Link>
        <div className="hidden items-center gap-7 text-sm text-graphite md:flex">
          {[["#preview", "The app"], ["#how", "How it works"], ["#notes", "Field notes"], ["#proof", "Proof"]].map(([h, l]) => (
            <a key={h} href={h} className="relative transition hover:text-carbon">{l}</a>
          ))}
        </div>
        <Magnetic strength={0.2}>
          <LaunchLink data-cursor="Launch"
            className="inline-flex items-center gap-2 rounded-full bg-carbon px-5 py-2 text-sm font-semibold text-paper">
            <span className="relative flex h-2 w-2"><span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-signal opacity-75" /><span className="relative inline-flex h-2 w-2 rounded-full bg-signal" /></span>
            Launch app
          </LaunchLink>
        </Magnetic>
      </div>
    </motion.nav>
  );
}
