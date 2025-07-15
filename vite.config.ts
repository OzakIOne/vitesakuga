import { defineConfig } from "vite";
import tsconfigPaths from "vite-tsconfig-paths";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import tailwindcss from "tailwindcss";
import viteReact from "@vitejs/plugin-react";
export default defineConfig({
  server: {
    port: 3000,
  },
  plugins: [
    tsconfigPaths(),
    tanstackStart({ customViteReactPlugin: true }),
    viteReact(),
  ],
});
