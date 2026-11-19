import { expect, test } from "@playwright/test";
import { agentOffline, freshVisit } from "./helpers";

test.describe("the app (/app)", () => {
  test("first visit shows the 3-step onboarding", async ({ page }) => {
    await freshVisit(page, { onboarded: false });
    await agentOffline(page);
    await page.goto("/app");
    await expect(page.getByText("Step 1 of 3")).toBeVisible();
    await page.getByRole("button", { name: "Next" }).click();
    await expect(page.getByText("Watch Synapse grow tools")).toBeVisible();
    await page.getByRole("button", { name: "Next" }).click();
    await expect(page.getByText("Approve anything that changes data")).toBeVisible();
    await page.getByRole("button", { name: "Skip" }).click();
    await expect(page.getByText("Step 1 of 3")).toBeHidden();
  });

  test("with the agent server offline it falls back to Replay and plays a real run to the answer", async ({ page }) => {
    await freshVisit(page);
    await agentOffline(page);
    await page.goto("/app");
    await expect(page.getByText("Recorded scenarios")).toBeVisible();
    await page.getByRole("button", { name: /Delayed shipment impact/ }).click();
    // tools grow during the run…
    await expect(page.getByText(/\d+ tools? live|Calling|grafted/).first()).toBeVisible({ timeout: 30_000 });
    // …and the answer joins three systems
    const answer = page.getByTestId("answer");
    await expect(answer).toContainText("CUS-101", { timeout: 60_000 });
    await expect(answer).toContainText("TKT-9001");
    await expect(page.getByText(/Answered in/)).toBeVisible();
  });

  test("refund replay shows the human approval card", async ({ page }) => {
    await freshVisit(page);
    await agentOffline(page);
    await page.goto("/app");
    await expect(page.getByText("Recorded scenarios")).toBeVisible();
    await page.getByRole("button", { name: /Process a refund/ }).click();
    await expect(page.getByText(/Grant write access\?|Allow this action\?/).first()).toBeVisible({ timeout: 30_000 });
    await expect(page.getByText(/RF-3001|8,?847/).first()).toBeVisible({ timeout: 60_000 });
  });

  test("live mode explains how to start the server when it is offline", async ({ page }) => {
    await freshVisit(page);
    await agentOffline(page);
    await page.goto("/app");
    await page.locator("header").getByRole("button", { name: "Live" }).click();
    await expect(page.getByText("The agent server isn't running")).toBeVisible();
    await expect(page.getByText("python -m synaptogenesis web --prewarm")).toBeVisible();
  });
});
