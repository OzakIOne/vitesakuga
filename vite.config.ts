import path from "node:path";
import tailwindcss from "@tailwindcss/vite";
import { devtools } from "@tanstack/devtools-vite";
import { nitroV2Plugin } from "@tanstack/nitro-v2-vite-plugin";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import viteReact from "@vitejs/plugin-react";
import { defineConfig } from "vite";
import { viteStaticCopy } from "vite-plugin-static-copy";
import tsconfigPaths from "vite-tsconfig-paths";

export default defineConfig({
  plugins: [
    tailwindcss(),
    tsconfigPaths(),
    tanstackStart(),
    // { customViteReactPlugin: true }
    devtools(),
    nitroV2Plugin(
      /*
      { target: 'node-server' }
      */
    ),
    viteReact(),
    viteStaticCopy({
      targets: [
        {
          dest: "",
          src: path.resolve(
            import.meta.dirname,
            "node_modules/mediainfo.js/dist/MediaInfoModule.wasm",
          ),
        },
      ],
    }),
  ],
  server: {
    port: 3000,
  },
});
