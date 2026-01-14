import { defineNitroConfig } from "nitro/config";

export default defineNitroConfig({
  cloudflare: {
    deployConfig: true,
    nodeCompat: true,
  },
  compatibilityDate: "2025-01-01",
  preset: "cloudflare_module",
});
