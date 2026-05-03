import { defineNitroConfig } from "nitro/config";

export default defineNitroConfig({
  cloudflare: {
    deployConfig: true,
    nodeCompat: true,
  },
  compatibilityDate: "latest",
  preset: "cloudflare_module",
});
