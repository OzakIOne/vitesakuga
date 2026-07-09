import { defineConfig } from "@playwright/test";

const CDP_WS_ENDPOINT = process.env["CDP_WS_ENDPOINT"];
if (!CDP_WS_ENDPOINT) {
  throw new Error("CDP_WS_ENDPOINT environment variable is required");
}
const CI = process.env["CI"];

export default defineConfig({
  expect: { timeout: 10000 },
  forbidOnly: !!CI,
  fullyParallel: true,
  outputDir: ".test-results",
  reporter: [["list"], ["html", { outputFolder: ".test-report" }]],
  retries: CI ? 2 : 0,
  testDir: ".",
  timeout: 60000,
  use: {
    baseURL: "http://localhost:3000",
    connectOptions: {
      wsEndpoint: CDP_WS_ENDPOINT,
    },
    trace: "on-first-retry",
  },
  workers: 1,
});
