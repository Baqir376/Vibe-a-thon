"use client";

import Link from "next/link";
import { motion, useMotionValueEvent, useScroll } from "motion/react";
import { useState } from "react";
import { LogoMark, Wordmark } from "@/components/Logo";

export function Nav() {
  const { scrollY } = useScroll();
  const [scrolled, setScrolled] = useState(false);
  useMotionValueEvent(scrollY, "change", (v) => setScrolled(v > 24));
  return (
    <motion.nav
      initial={{ y: -40, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.3, duration: 0.6 }}
      className="fixed inset-x-0 top-4 z-50 flex justify-center px-4"
    >
      <div className={`flex w-full max-w-5xl items-center justify-between rounded-full px-4 py-2 transition-all duration-500 ${scrolled ? "glass shadow-[0_8px_40px_rgba(0,0,0,.45)]" : "border border-transparent"}`}>
        <Link href="/" className="flex items-center gap-2"><LogoMark size={26} /><Wordmark className="text-[17px]" /></Link>
        <div className="hidden items-center gap-7 text-sm text-muted md:flex">
          <a href="#how" className="transition hover:text-text">How it works</a>
          <a href="#capabilities" className="transition hover:text-text">Capabilities</a>
          <a href="#proof" className="transition hover:text-text">Proof</a>
        </div>
        <Link href="/console"
          className="group relative overflow-hidden rounded-full bg-violet px-4 py-1.5 text-sm font-semibold text-[#160d33] transition hover:shadow-[0_0_30px_rgba(167,139,250,.55)]">
          <span className="relative z-10">Live console →</span>
          <span className="shimmer absolute inset-0" />
        </Link>
      </div>
    </motion.nav>
  );
}
