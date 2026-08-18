// Generates `.dev.vars` (Cloudflare local preview env) from `.env` (dev stage).
//
// Nitro's `cloudflare_module` preview (`vite preview`) runs the built Worker
// through `wrangler dev`, which does NOT forward the host process environment
// to workerd. The only channel into a local Worker is a `.dev.vars` file next
// to the wrangler config (here the project root — wrangler is run with
// `--cwd ./`). Nitro's docs: "If you are using a `.env` file while developing,
// your `.dev.vars` should be identical to it."
//
// This keeps `.dev.vars` in sync with `.env` so `nub run server` just works.
// The preview serves the production build, so `NODE_ENV` is forced to
// `production` (required by `src/lib/env/defs.ts`). `.dev.vars` is gitignored
// (mirrors `.env`).

import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { parse } from "dotenv";

const root = fileURLToPath(new URL("..", import.meta.url));
const envPath = resolve(root, ".env");
const devVarsPath = resolve(root, ".dev.vars");

try {
  readFileSync(envPath);
} catch {
  console.error(`→ ${envPath} not found`);
  console.error(`  copy .env.example to .env and configure it first`);
  process.exit(1);
}

const vars = parse(readFileSync(envPath, "utf8"));
vars.NODE_ENV = "production";

// `JSON.stringify` quotes values so `#`, spaces, and special chars are safe for
// dotenv-style parsing (keys are parsed env keys; only simple identifier keys).
const lines = Object.entries(vars).map(
  ([key, value]) => `${key}=${JSON.stringify(value)}`,
);

writeFileSync(devVarsPath, `${lines.join("\n")}\n`);
console.log(`→ wrote ${devVarsPath} (${lines.length} vars, ${envPath})`);
