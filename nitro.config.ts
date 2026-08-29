import * as dotenv from "dotenv";
import { defineNitroConfig } from "nitro/config";

// Nitro config runs before Vite loads any env file, so stage values must be
// loaded explicitly to compute the CSP (same pattern as drizzle.config.ts).
const ENV_FILES = {
  development: ".env",
  dev: ".env",
  production: ".env.production",
  prod: ".env.production",
  local: ".env.test",
  test: ".env.test",
} satisfies Record<string, string>;
const stage = process.env["APP_ENV"] ?? "development";
// SAFETY: Object.hasOwn guards the lookup, so the assertion only fires when
// the key genuinely exists on ENV_FILES.
const envFile = Object.hasOwn(ENV_FILES, stage)
  ? ENV_FILES[stage as keyof typeof ENV_FILES]
  : `.env.${stage}`;
dotenv.config({ path: envFile });

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

// Direct-to-R2 video uploads: the browser PUTs video bytes to the presigned
// URL on the S3 API endpoint (storage.adapter.ts `presignVideoUpload`), which
// is cross-origin from the app in every stage. The SDK signs virtual-hosted
// style URLs — the bucket name prefixes the endpoint host — so the origin
// carries the bucket as an extra label. A CSP host wildcard matches exactly
// one label, so `*.<endpoint-host>` covers every bucket on the account.
const r2UploadOrigin = (() => {
  const endpoint = process.env["CLOUDFLARE_R2"];
  if (!endpoint) {
    return "";
  }
  try {
    return new URL(endpoint).origin.replace("https://", "https://*.");
  } catch {
    return "";
  }
})();

// The local rustfs endpoint used by the dev:local stage (storage.adapter.ts
// hardcodes it when DATABASE_DRIVER=local); production never uploads locally.
const localUploadOrigins = isProductionStage ? [] : ["http://localhost:9000"];

const connectSources = ["'self'", r2UploadOrigin, ...localUploadOrigins]
  .filter(Boolean)
  .join(" ");

// Turnstile (challenges.cloudflare.com): the api.js script plus the widget
// iframe. Both are required by the captcha plugin in the auth pages.
const turnstileSource = "https://challenges.cloudflare.com";

// script-src 'wasm-unsafe-eval': mediainfo.js compiles its WASM module
// (/MediaInfoModule.wasm, self-hosted) via WebAssembly.instantiate, which the
// CSP spec gates behind this source. It allows WebAssembly compilation only —
// not eval — so it is safe to keep in every stage, including production.
const scriptSource = isProductionStage
  ? `'self' 'wasm-unsafe-eval' 'sha256-gb6dNSVZKu5ARVoUjTW1x8JnToWeIcP2K0lB6J49wPA=' ${turnstileSource}`
  : `'self' 'wasm-unsafe-eval' 'unsafe-inline' ${turnstileSource}`;

// img-src allows any https image on purpose: profile pictures are
// user-supplied URLs (any host), and CSP cannot match by file extension, so a
// per-origin allow-list would need updating for every new host. Images are the
// lowest-risk resource type (no script execution from <img>); media-src for
// video stays strictly allow-listed.
const contentSecurityPolicy = `default-src 'self'; script-src ${scriptSource}; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob: https:; media-src 'self' blob: ${mediaSources}; connect-src ${connectSources}; font-src 'self' data:; object-src 'none'; frame-src 'self' ${turnstileSource}; frame-ancestors 'none'; base-uri 'self'; form-action 'self'`;

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
  // - connect-src also allows the R2 S3 API endpoint: direct-to-R2 video
  //   uploads PUT presigned URLs cross-origin from the browser (plus the
  //   local rustfs endpoint in non-production stages).
  // - The single inline theme-bootstrap script is allow-listed by its SHA-256
  //   hash (regenerate it if the next-themes injector ever changes: fetch the
  //   page, hash the inline <script> content, and replace the value below).
  // - Turnstile's api.js and widget iframe come from challenges.cloudflare.com
  //   (see https://developers.cloudflare.com/turnstile/reference/content-security-policy/).
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
