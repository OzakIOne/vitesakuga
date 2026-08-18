import { defineNitroConfig } from "nitro/config";

export default defineNitroConfig({
  cloudflare: {
    deployConfig: true,
    nodeCompat: true,
  },
  compatibilityDate: "2026-04-21",
  preset: "cloudflare_module",
  // Override Nitro's `npx wrangler` preview default: `npx` resolves to the system
  // npm (Node 24), which rejects nub's Node 26-only NODE_OPTIONS flags (e.g.
  // `--experimental-import-text`) and crashes `vite preview`. The local wrangler
  // bin runs under the project's Node 26 via the node PATH shim, so NODE_OPTIONS
  // is always compatible.
  commands: {
    preview: "node_modules/.bin/wrangler --cwd ./ dev",
  },
});
