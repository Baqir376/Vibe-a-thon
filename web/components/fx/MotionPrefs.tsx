"use client";

import { MotionConfig } from "motion/react";
import type { ReactNode } from "react";

/** Respect the OS "reduce motion" setting for every Motion animation in the app. */
export function MotionPrefs({ children }: { children: ReactNode }) {
  return <MotionConfig reducedMotion="user">{children}</MotionConfig>;
}
