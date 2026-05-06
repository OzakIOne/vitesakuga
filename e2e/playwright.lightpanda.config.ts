import { defineConfig } from "@playwright/test";

export default defineConfig({
  expect: { timeout: 10000 },
  forbidOnly: !!process.env.CI,
  fullyParallel: true,
  outputDir: ".test-results",
  reporter: [["list"], ["html", { outputFolder: ".test-report" }]],
  retries: process.env.CI ? 2 : 0,
  testDir: ".",
  timeout: 60000,
  use: {
    baseURL: "http://localhost:3000",
    connectOptions: {
      wsEndpoint: process.env.CDP_WS_ENDPOINT!,
    },
    trace: "on-first-retry",
  },
  workers: 1,
});
