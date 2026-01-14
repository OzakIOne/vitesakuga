import tailwindcss from "@tailwindcss/vite";
import { devtools } from "@tanstack/devtools-vite";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import viteReact from "@vitejs/plugin-react";
import { nitro } from "nitro/vite";
import { defineConfig } from "vite";
import { viteStaticCopy } from "vite-plugin-static-copy";
import viteTsConfigPaths from "vite-tsconfig-paths";

export default defineConfig({
  plugins: [
    tailwindcss(),
    viteTsConfigPaths({
      projects: ["./tsconfig.json"],
    }),
    tanstackStart(),
    devtools(),
    nitro(),
    viteReact(),
    viteStaticCopy({
      targets: [
        {
          dest: "",
          src: "node_modules/mediainfo.js/dist/MediaInfoModule.wasm",
        },
      ],
    }),
  ],
  server: {
    port: 3000,
  },
});
