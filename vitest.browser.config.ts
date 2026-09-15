/// <reference types="@vitest/browser/matchers" />

import { playwright } from "@vitest/browser-playwright";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    tsconfigPaths: true,
  },
  test: {
    exclude: ["e2e/**", "node_modules/**", "dist/**", ".opencode/**"],
    include: ["src/**/*.browser.test.tsx"],
    name: "browser",
    browser: {
      enabled: true,
      headless: true,
      instances: [{ browser: "chromium" }],
      provider: playwright(),
    },
  },
});
