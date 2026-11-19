import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";
import { agentOffline, freshVisit, settle } from "./helpers";

// WCAG 2.1 A/AA. Serious and critical violations fail the build; the rest are reported.
async function audit(page: import("@playwright/test").Page) {
  const r = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]).exclude("canvas").analyze();
  const bad = r.violations.filter((v) => v.impact === "serious" || v.impact === "critical");
  if (bad.length) console.log(JSON.stringify(bad.map((v) => ({ id: v.id, impact: v.impact, nodes: v.nodes.slice(0, 3).map((n) => n.target) })), null, 1));
  return bad;
}

// Audited with reduced motion: content is static and settled (and this exercises the reduced-motion mode itself).
test.use({ reducedMotion: "reduce" });
test.setTimeout(150_000);

test("landing page has no serious accessibility violations", async ({ page }) => {
  await freshVisit(page);
  await page.goto("/");
  // scroll through once so every reveal-on-scroll element has finished animating, then audit the settled page
  // scroll through once so reveal-on-scroll content is shown, then audit the settled page
  await page.evaluate(async () => {
    for (let y = 0; y < document.body.scrollHeight; y += 500) { window.scrollTo(0, y); await new Promise((r) => setTimeout(r, 60)); }
    window.scrollTo(0, 0);
  });
  await settle(page).catch(() => {}); // best effort: decorative loops may keep running
  expect(await audit(page)).toEqual([]);
});

test("app has no serious accessibility violations", async ({ page }) => {
  await freshVisit(page);
  await agentOffline(page);
  await page.goto("/app");
  await expect(page.getByText("Recorded scenarios")).toBeVisible();
  await settle(page).catch(() => {});
  expect(await audit(page)).toEqual([]);
});
