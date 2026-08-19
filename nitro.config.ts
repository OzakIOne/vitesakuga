import { defineNitroConfig } from "nitro/config";

export default defineNitroConfig({
  cloudflare: {
    deployConfig: true,
    nodeCompat: true,
  },
  compatibilityDate: "2026-04-21",
  preset: "cloudflare_module",
  // Security response headers applied to every response the app serves.
  // - CSP allows self + the public media bucket for BOTH stages
  //   (media-dev.ozaki.one dev / media.ozaki.one prod, per the domainSuffix
  //   logic in infra/alchemy.run.ts). The config is shared across stages, so
  //   both origins are allow-listed; dropping the prod one would break media.
  // - The single inline theme-bootstrap script is allow-listed by its SHA-256
  //   hash (regenerate it if the next-themes injector ever changes: fetch the
  //   page, hash the inline <script> content, and replace the value below).
  // - style-src 'unsafe-inline' is required by Ark UI / React inline style attrs.
  // - No COEP on purpose (would break the media bucket); CORP set to same-site so
  //   the media bucket on the same registrable domain still loads.
  routeRules: {
    "/**": {
      headers: {
        "content-security-policy":
          "default-src 'self'; script-src 'self' 'sha256-gb6dNSVZKu5ARVoUjTW1x8JnToWeIcP2K0lB6J49wPA='; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob: https://media-dev.ozaki.one https://media.ozaki.one; media-src 'self' blob: https://media-dev.ozaki.one https://media.ozaki.one; connect-src 'self'; font-src 'self' data:; object-src 'none'; frame-ancestors 'none'; base-uri 'self'; form-action 'self'",
        "strict-transport-security": "max-age=31536000; includeSubDomains",
        "x-content-type-options": "nosniff",
        "referrer-policy": "strict-origin-when-cross-origin",
        "x-frame-options": "DENY",
        "permissions-policy":
          "camera=(), microphone=(), geolocation=(), payment=(), usb=(), accelerometer=(), gyroscope=(), magnetometer=()",
        "cross-origin-opener-policy": "same-origin",
        "cross-origin-resource-policy": "same-site",
      },
    },
  },
  // Override Nitro's `npx wrangler` preview default: `npx` resolves to the system
  // npm (Node 24), which rejects nub's Node 26-only NODE_OPTIONS flags (e.g.
  // `--experimental-import-text`) and crashes `vite preview`. The local wrangler
  // bin runs under the project's Node 26 via the node PATH shim, so NODE_OPTIONS
  // is always compatible.
  commands: {
    preview: "node_modules/.bin/wrangler --cwd ./ dev",
  },
});
