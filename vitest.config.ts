import viteTsConfigPaths from "vite-tsconfig-paths";
import { defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [viteTsConfigPaths()],
  test: {
    environment: "node", // Logic-only tests don't need jsdom
    globals: false, // We are using explicit imports
  },
});
