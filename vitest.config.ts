import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    tsconfigPaths: true,
  },
  test: {
    env: {
      BASE_URL: "/",
      BETTER_AUTH_SECRET: "test-secret-with-at-least-32-characters!!",
      CLOUDFLARE_ACCESS_KEY: "GK1a2b3c4d5e6f7a8b9c0d1e2f3a4b5c6d",
      CLOUDFLARE_BUCKET: "e2e-test",
      CLOUDFLARE_R2: "http://localhost:3900",
      CLOUDFLARE_SECRET_KEY:
        "1a2b3c4d5e6f7a8b9c0d1e2f3a4b5c6d1a2b3c4d5e6f7a8b9c0d1e2f3a4b5c6d",
      DATABASE_URL: "postgresql://user:password@localhost:5432/test",
      DEV: "true",
      GITHUB_CLIENT_ID: "test-client-id",
      GITHUB_CLIENT_SECRET: "test-client-secret",
      MODE: "development",
      NODE_ENV: "development",
      PROD: "false",
      SSR: "false",
      VITE_BASE_URL: "http://localhost:3000",
    },
    environment: "node", // Logic-only tests don't need jsdom
    exclude: ["e2e/**", "node_modules/**", "dist/**", ".opencode/**"],
    globals: false, // We are using explicit imports
    setupFiles: ["./vitest.setup.ts"],
  },
});
