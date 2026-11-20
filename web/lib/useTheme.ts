"use client";

import { useCallback, useEffect, useState } from "react";

export type Theme = "dark" | "light";

/** App theme. The attribute is set in <head> before paint (no flash); this keeps React in sync. */
export function useTheme() {
  const [theme, setTheme] = useState<Theme>("dark");
  useEffect(() => {
    const t = document.documentElement.getAttribute("data-app-theme");
    // eslint-disable-next-line react-hooks/set-state-in-effect -- read the pre-paint attribute once
    if (t === "light") setTheme("light");
  }, []);
  const toggle = useCallback(() => {
    setTheme((cur) => {
      const next: Theme = cur === "dark" ? "light" : "dark";
      document.documentElement.setAttribute("data-app-theme", next);
      try { localStorage.setItem("synapto-theme", next); } catch { /* ignore */ }
      return next;
    });
  }, []);
  return { theme, light: theme === "light", toggle };
}
