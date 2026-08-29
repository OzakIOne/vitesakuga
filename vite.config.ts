import fs from "fs";
import path from "node:path";

import tailwindcss from "@tailwindcss/vite";
import { devtools } from "@tanstack/devtools-vite";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import viteReact from "@vitejs/plugin-react";
import { nitro } from "nitro/vite";
import { defineConfig } from "vite";

const wasmPath = path.resolve(
  import.meta.dirname,
  "node_modules/mediainfo.js/dist/MediaInfoModule.wasm",
);

function copyFilePlugin() {
  return {
    name: "copy-file-plugin",
    buildStart() {
      const src = path.resolve(wasmPath);
      const dest = path.resolve(
        import.meta.dirname,
        "public/MediaInfoModule.wasm",
      );
      fs.copyFileSync(src, dest);
    },
    configureServer() {
      const src = path.resolve(wasmPath);
      const dest = path.resolve(
        import.meta.dirname,
        "public/MediaInfoModule.wasm",
      );
      fs.copyFileSync(src, dest);
    },
  };
}

export default defineConfig({
  plugins: [
    devtools(),
    copyFilePlugin(),
    tailwindcss(),
    tanstackStart({
      // TanStack Start's dev-styles middleware is skipped in `--mode test`
      // (see dev-server-plugin `isTest` gate) while SSR still emits the
      // `/@tanstack-start/styles.css` link, causing 404s on every page.
      // The app loads CSS via `?url` imports, so this collection is unused.
      dev: { ssrStyles: { enabled: false } },
    }),
    nitro(),
    viteReact(),
  ],
  resolve: {
    tsconfigPaths: true,
  },
  server: {
    port: 3000,
  },
});
