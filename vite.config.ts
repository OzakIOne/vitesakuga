import { defineConfig } from "vite";
import tsconfigPaths from "vite-tsconfig-paths";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import viteReact from "@vitejs/plugin-react";
import { nitroV2Plugin } from "@tanstack/nitro-v2-vite-plugin";
import { devtools } from "@tanstack/devtools-vite";
import tailwindcss from "@tailwindcss/vite";
import { viteStaticCopy } from 'vite-plugin-static-copy'
import path from 'node:path'

export default defineConfig({
  server: {
    port: 3000,
  },
  plugins: [
    tailwindcss(),
    tsconfigPaths(),
    tanstackStart(),
    // { customViteReactPlugin: true }
    devtools(),
    nitroV2Plugin(/*
      { target: 'node-server' }
      */),
    viteReact(),
    viteStaticCopy({
      targets: [
        {
          src: path.resolve(
            import.meta.dirname,
            'node_modules/mediainfo.js/dist/MediaInfoModule.wasm'
          ),
          dest: '',
        },
      ],
    }),
  ],
});
