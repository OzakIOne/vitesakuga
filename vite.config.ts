import fs from "fs";
import path from "node:path";

import tailwindcss from "@tailwindcss/vite";
import { devtools } from "@tanstack/devtools-vite";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import viteReact from "@vitejs/plugin-react";
import { nitro } from "nitro/vite";
import { defineConfig } from "vite";

const wasmPath = path.resolve(
  __dirname,
  "node_modules/mediainfo.js/dist/MediaInfoModule.wasm",
);

function copyFilePlugin() {
  return {
    name: "copy-file-plugin",
    buildStart() {
      const src = path.resolve(wasmPath);
      const dest = path.resolve(__dirname, "public/MediaInfoModule.wasm");
      fs.copyFileSync(src, dest);
    },
    configureServer() {
      const src = path.resolve(wasmPath);
      const dest = path.resolve(__dirname, "public/MediaInfoModule.wasm");
      fs.copyFileSync(src, dest);
    },
  };
}

export default defineConfig({
  plugins: [
    copyFilePlugin(),
    tailwindcss(),
    tanstackStart(),
    devtools(),
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
