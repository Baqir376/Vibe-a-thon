import type { Page } from "@playwright/test";

/** Skip the boot animation and (optionally) the first-visit onboarding. */
export async function freshVisit(page: Page, { onboarded = true } = {}) {
  await page.addInitScript((ob) => {
    sessionStorage.setItem("synapto-boot", "1");
    if (ob) localStorage.setItem("synapto-onboarded", "1");
    else localStorage.removeItem("synapto-onboarded");
  }, onboarded);
}

/** Simulate a judge opening the deployed site: the Python agent server is unreachable. */
export async function agentOffline(page: Page) {
  await page.route(/127\.0\.0\.1:8700|localhost:8700/, (r) => r.abort());
}

/** Wait until every finite animation on the page has finished (reveal-on-scroll, fades, springs). */
export async function settle(page: Page, timeout = 8_000) {
  await page.waitForFunction(() =>
    document.getAnimations().filter((a) => {
      const t = a.effect?.getComputedTiming();
      return a.playState === "running" && t && Number.isFinite(t.endTime as number);
    }).length === 0, null, { timeout, polling: 250 });
  await page.waitForTimeout(400);
}
