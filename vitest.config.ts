import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    tsconfigPaths: true,
  },
  test: {
    environment: "node", // Logic-only tests don't need jsdom
    globals: false, // We are using explicit imports
  },
});
