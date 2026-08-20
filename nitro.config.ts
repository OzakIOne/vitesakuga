import { defineNitroConfig } from "nitro/config";

// The strict, hash-allowlisted CSP is only viable in the production stage.
// Every other stage (dev, local/test, preview) runs Vite's dev or the dev
// deployment, where TanStack Start injects inline bootstrap scripts (stream
// barrier, window.$_TSR payload, React Fast Refresh preamble) that a single
// hash cannot cover — blocking them breaks hydration ("Expected to find
// bootstrap data on window.$_TSR").
const isProductionStage = process.env["APP_ENV"] === "production";

const r2PublicUrl = process.env["VITE_CLOUDFLARE_R2_PUBLIC_URL"];
const r2Origin = r2PublicUrl ? new URL(r2PublicUrl).origin : "";

// The bucket's public origins for every stage (custom media domains + the
// stage's R2 public URL, e.g. http://localhost:9000 for the local rustfs).
const mediaSources = [
  r2Origin,
  "https://media-dev.ozaki.one",
  "https://media.ozaki.one",
]
  .filter(Boolean)
  .join(" ");

const scriptSource = isProductionStage
  ? "'self' 'sha256-gb6dNSVZKu5ARVoUjTW1x8JnToWeIcP2K0lB6J49wPA='"
  : "'self' 'unsafe-inline'";

const contentSecurityPolicy = `default-src 'self'; script-src ${scriptSource}; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob: ${mediaSources}; media-src 'self' blob: ${mediaSources}; connect-src 'self'; font-src 'self' data:; object-src 'none'; frame-ancestors 'none'; base-uri 'self'; form-action 'self'`;

export default defineNitroConfig({
  cloudflare: {
    deployConfig: true,
    nodeCompat: true,
  },
  compatibilityDate: "2026-04-21",
  preset: "cloudflare_module",
  // App-level rate limiter for mutation requests (defence-in-depth over the
  // Cloudflare edge binding + a dev implementation). Global middleware.
  handlers: [
    {
      route: "/**",
      handler: "./src/lib/rate-limit/rate-limit.middleware.ts",
      middleware: true,
    },
  ],
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
        "content-security-policy": contentSecurityPolicy,
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
