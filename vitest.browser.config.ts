/// <reference types="@vitest/browser/matchers" />

import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import viteReact from "@vitejs/plugin-react";
import { playwright } from "@vitest/browser-playwright";
import { defineConfig } from "vitest/config";

export default defineConfig({
  optimizeDeps: {
    include: [
      "@ark-ui/react",
      "@better-auth/passkey/client",
      "@tanstack/markdown/react",
      "@tanstack/react-query",
      "@tanstack/react-router",
      "@tanstack/react-start",
      "better-auth/client/plugins",
      "better-auth/react",
      "drizzle-orm/pg-core",
      "effect",
      "kysely",
      "react-icons/lu",
      "vitest-browser-react",
    ],
  },
  plugins: [
    tanstackStart({
      dev: { ssrStyles: { enabled: false } },
    }),
    viteReact(),
  ],
  resolve: {
    tsconfigPaths: true,
  },
  test: {
    exclude: ["e2e/**", "node_modules/**", "dist/**", ".opencode/**"],
    include: ["src/**/*.browser.test.tsx"],
    name: "browser",
    fileParallelism: false,
    browser: {
      enabled: true,
      headless: true,
      instances: [{ browser: "chromium" }],
      provider: playwright(),
    },
  },
});
