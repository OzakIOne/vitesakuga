import { defineConfig } from "@playwright/test";

const CI = process.env["CI"];

export default defineConfig({
  expect: { timeout: 10000 },
  forbidOnly: !!CI,
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
  reporter: [
    ["list"],
    ["html", { outputFolder: ".test-report", host: "0.0.0.0" }],
  ],
  retries: CI ? 2 : 0,
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
      reuseExistingServer: !CI,
      timeout: 120000,
      env: {
        DATABASE_DRIVER: "pglite",
        DATABASE_URL: "postgresql://e2e:e2e@localhost:5432/e2e",
        CLOUDFLARE_ACCESS_KEY: "GK1a2b3c4d5e6f7a8b9c0d1e2f3a4b5c6d",
        CLOUDFLARE_BUCKET: "e2e-test",
        CLOUDFLARE_R2: "http://localhost:3900",
        CLOUDFLARE_R2_PUBLIC_URL: "http://localhost:3900/e2e-test",
        CLOUDFLARE_SECRET_KEY:
          "1a2b3c4d5e6f7a8b9c0d1e2f3a4b5c6d1a2b3c4d5e6f7a8b9c0d1e2f3a4b5c6d",
      },
    },
  ],
  workers: 1,
});
