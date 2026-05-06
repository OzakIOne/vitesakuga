import { defineConfig } from "@playwright/test";

export default defineConfig({
  expect: { timeout: 10000 },
  forbidOnly: !!process.env.CI,
  fullyParallel: true,
  globalSetup: "./global-setup.ts",
  outputDir: ".test-results",
  projects: [
    {
      name: "chromium",
      use: {
        launchOptions: {
          env: {
            FONTCONFIG_PATH: "/tmp/fontconfig",
            LD_LIBRARY_PATH: "/tmp/playwright-deps/usr/lib",
          },
        },
      },
    },
  ],
  reporter: [["list"], ["html", { outputFolder: ".test-report" }]],
  retries: process.env.CI ? 2 : 0,
  testDir: ".",
  timeout: 60000,
  use: {
    baseURL: "http://localhost:3000",
    trace: "on-first-retry",
  },
  webServer: [
    {
      command: "pnpm dev",
      cwd: "..",
      port: 3000,
      reuseExistingServer: !process.env.CI,
      timeout: 120000,
    },
  ],
  workers: 1,
});
