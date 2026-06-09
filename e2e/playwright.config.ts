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
            LD_LIBRARY_PATH: "/usr/lib",
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
      env: {
        DATABASE_DRIVER: "pglite",
        DATABASE_URL: "postgresql://e2e:e2e@localhost:5432/e2e",
        CLOUDFLARE_ACCESS_KEY: "rustfsadmin",
        CLOUDFLARE_BUCKET: "e2e-test",
        CLOUDFLARE_R2: "http://localhost:9000",
        CLOUDFLARE_R2_PUBLIC_URL: "http://localhost:9000/e2e-test",
        CLOUDFLARE_SECRET_KEY: "rustfsadmin",
      },
    },
  ],
  workers: 1,
});
