import { defineConfig, devices } from "@playwright/test";

const PORT = Number(process.env.E2E_PORT ?? 3100);

/** E2E + accessibility. Locally reuses a running `npm run dev`; in CI builds and starts production. */
export default defineConfig({
  testDir: "./e2e",
  timeout: 90_000,
  expect: { timeout: 15_000 },
  retries: process.env.CI ? 1 : 0,
  workers: process.env.CI ? 2 : 3, // 3D + canvas pages are heavy; too many parallel browsers skew timing
  reporter: [["list"], ["html", { open: "never", outputFolder: "playwright-report" }]],
  use: {
    baseURL: `http://localhost:${PORT}`,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    viewport: { width: 1440, height: 900 },
  },
  projects: [
    { name: "desktop-chromium", use: { ...devices["Desktop Chrome"], viewport: { width: 1440, height: 900 } } },
    { name: "mobile", use: { ...devices["Pixel 7"] }, testMatch: /landing|a11y/ },
  ],
  webServer: {
    // Tests run against a production build on its own port (no dev-compile timing, no clash with `npm run dev`).
    command: `npm run build && npx next start -p ${PORT}`,
    url: `http://localhost:${PORT}`,
    reuseExistingServer: !process.env.CI,
    timeout: 240_000,
  },
});
