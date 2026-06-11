import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    tsconfigPaths: true,
  },
  test: {
    env: {
      BASE_URL: "/",
      BETTER_AUTH_SECRET: "test-secret-with-at-least-32-characters!!",
      CLOUDFLARE_ACCESS_KEY: "rustfsadmin",
      CLOUDFLARE_BUCKET: "e2e-test",
      CLOUDFLARE_R2: "http://localhost:9000",
      CLOUDFLARE_SECRET_KEY: "rustfsadmin",
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
    exclude: ["e2e/**", "node_modules/**", "dist/**"],
    globals: false, // We are using explicit imports
    setupFiles: ["./vitest.setup.ts"],
  },
});
