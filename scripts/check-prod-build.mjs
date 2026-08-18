#!/usr/bin/env node
/**
 * Pre-deploy guard for the Cloudflare Worker build.
 *
 * Refuses to deploy a bundle produced with `NODE_ENV=development`: such builds
 * emit React `jsx-dev-runtime` (`jsxDEV`) calls into the SSR chunks, but the
 * bundled React libs are the production builds where `exports.jsxDEV = void 0`.
 * Every page then throws `TypeError: jsxDEV is not a function`, which TanStack
 * Start surfaces as a 500 with the generic
 * `{"status":500,"unhandled":true,"message":"HTTPError"}` payload.
 * (Neither the prod `nub run build` nor the dev `nub run build:dev`
 * produce such bundles — see docs/build-environment.md.)
 *
 * Wire it in front of the alchemy deploy scripts in package.json:
 *   "infra:deploy": "nub run build:dev && nub scripts/check-prod-build.mjs && alchemy deploy ..."
 */
import { existsSync, readdirSync, readFileSync } from "node:fs";

const SSR_DIR = new URL("../.output/server/_ssr/", import.meta.url);
const NITRO_JSON = new URL("../.output/nitro.json", import.meta.url);
const SERVER_ENTRY = new URL("../.output/server/index.mjs", import.meta.url);

// SSR chunks compiled with the React dev JSX runtime call this require shim
// (`require_jsx_dev_runtime().jsxDEV(...)`). Production builds never emit it.
const DEV_JSX_MARKER = "require_jsx_dev_runtime(";

const missing = [
  [NITRO_JSON, ".output/nitro.json"],
  [SERVER_ENTRY, ".output/server/index.mjs"],
]
  .filter(([url]) => !existsSync(url))
  .map(([, label]) => label);

if (missing.length > 0) {
  console.error(
    `✘ Refusing to deploy: build output is missing (${missing.join(", ")}).`,
  );
  console.error(
    "  Run `nub run build` (prod) or `nub run build:dev` (dev), or use",
  );
  console.error(
    "  `nub run infra:deploy` / `infra:deploy:prod` (builds first).",
  );
  process.exit(1);
}

let devJsxChunks = 0;
for (const file of readdirSync(SSR_DIR)) {
  if (!file.endsWith(".mjs")) continue;
  if (readFileSync(new URL(file, SSR_DIR), "utf8").includes(DEV_JSX_MARKER)) {
    devJsxChunks += 1;
  }
}

if (devJsxChunks > 0) {
  console.error(
    `✘ Refusing to deploy: development-mode SSR build detected (${devJsxChunks} chunk(s) use the React dev JSX runtime).`,
  );
  console.error(
    "  This bundle 500s with `jsxDEV is not a function` on Cloudflare.",
  );
  console.error(
    "  Rebuild with `nub run build` (prod) or `nub run build:dev` (dev), or use",
  );
  console.error(
    "  `nub run infra:deploy` / `infra:deploy:prod` (builds first).",
  );
  console.error("  Do NOT deploy a bundle built with `NODE_ENV=development`.");
  process.exit(1);
}

console.log(
  "✔ Deployment guard passed: production-grade SSR bundle (no dev JSX runtime).",
);
