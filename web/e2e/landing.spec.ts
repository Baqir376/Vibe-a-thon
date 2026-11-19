import { expect, test } from "@playwright/test";
import { freshVisit } from "./helpers";

test.describe("landing (marketing)", () => {
  test("hero tells the story and leads to the app", async ({ page }) => {
    await freshVisit(page);
    await page.goto("/");
    await expect(page.getByRole("heading", { level: 1 })).toContainText("Agents that");
    await expect(page.getByRole("heading", { level: 1 })).toContainText("tools.");
    await expect(page.getByText("Synapse CLI").first()).toBeVisible();
    await page.getByRole("link", { name: /Launch the app/ }).first().click();
    await expect(page).toHaveURL(/\/app$/);
  });

  test("all landing sections render", async ({ page }) => {
    await freshVisit(page);
    await page.goto("/");
    for (const id of ["preview", "how", "notes", "proof"]) await expect(page.locator(`#${id}`)).toBeAttached();
    await page.locator("#proof").scrollIntoViewIfNeeded();
    await expect(page.getByText("Benchmark: every tool pre-loaded vs. just-in-time")).toBeVisible();
  });

  test("old /console link redirects to /app", async ({ page }) => {
    await freshVisit(page);
    await page.goto("/console");
    await expect(page).toHaveURL(/\/app$/);
  });

  test("boot sequence plays on the first visit only", async ({ page }) => {
    await page.goto("/");
    await expect(page.locator(".boot-overlay")).toBeVisible();
    await expect(page.locator(".boot-overlay")).toBeHidden({ timeout: 10_000 });   // auto-dismisses
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    await page.reload();
    await expect(page.locator(".boot-overlay")).toBeHidden();                       // returning visitor: no boot
  });
});
