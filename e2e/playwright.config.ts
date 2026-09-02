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
    // Dedicated port (3100) so e2e runs never collide with the dev server
    // (`nub run dev` on 3000): reuseExistingServer would otherwise silently
    // reuse it — and test against the wrong database.
    baseURL: "http://localhost:3100",
    trace: "on-first-retry",
  },
  webServer: [
    {
      // Mode test (not development) so `.env.test` takes precedence over
      // `.env` in the env-file cascade — nitro/c12 would otherwise override
      // DATABASE_URL with the `.env` Neon connection and the app would run
      // against the remote dev database instead of the local Postgres.
      command: "nub exec vite dev --mode test --host --port 3100",
      cwd: "..",
      port: 3100,
      reuseExistingServer: !CI,
      timeout: 120000,
      env: {
        APP_ENV: "test",
        NODE_ENV: "test",
        // "e2e" behaves like the local Postgres driver (see src/lib/db/pool.ts)
        // but is distinct so the e2e auth bypass in session.effect.ts stays
        // unreachable from `nub run dev:local`.
        DATABASE_DRIVER: "e2e",
        DATABASE_URL:
          "postgresql://user:password@localhost:5432/sakuga?sslmode=disable",
        CLOUDFLARE_ACCESS_KEY: "rustfsadmin",
        CLOUDFLARE_BUCKET: "e2e-test",
        CLOUDFLARE_R2: "http://localhost:9000",
        CLOUDFLARE_R2_PUBLIC_URL: "http://localhost:9000/e2e-test",
        CLOUDFLARE_SECRET_KEY: "rustfsadmin",
        // Real-auth e2e flows (2FA challenge, passkeys) sign up and sign in
        // against the local dev server; without this, Vite inherits the
        // `VITE_BASE_URL` from `.env` (a remote dev origin), which would send
        // auth traffic off-machine and set Secure cookies that never persist
        // over http://localhost.
        VITE_BASE_URL: "http://localhost:3100",
      },
    },
  ],
  workers: 1,
});
