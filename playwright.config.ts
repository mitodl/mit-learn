/* eslint-disable import/no-extraneous-dependencies,import/no-duplicates,import/no-restricted-paths */
import { defineConfig, devices } from "@playwright/test"

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  timeout: Number(process.env.PLAYWRIGHT_TIMEOUT) || 30_000,
  expect: { timeout: Number(process.env.PLAYWRIGHT_EXPECT_TIMEOUT) || 5_000 },
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 1,
  workers: process.env.CI ? 1 : undefined,
  reporter: [["html", { port: 9229, host: "0.0.0.0" }], ["list"]],
  use: {
    baseURL: process.env.PLAYWRIGHT_BASE_URL || "http://nginx:8063",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
    ignoreHTTPSErrors: true,
  },

  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],

  webServer: undefined,
})
