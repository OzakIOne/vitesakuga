import * as dotenv from "dotenv";
import { defineConfig } from "drizzle-kit";

import { loadServerEnv } from "./src/lib/env/defs";

const ENV_FILES = {
  development: ".env",
  dev: ".env",
  production: ".env.production",
  prod: ".env.production",
  local: ".env.test",
  test: ".env.test",
} satisfies Record<string, string>;

const stage = process.env["STAGE"] ?? "development";
// SAFETY: `stage` is one of the map keys for the known stages; ad-hoc STAGE
// values fall through to the `.env.<stage>` fallback below.
const envFile = ENV_FILES[stage as keyof typeof ENV_FILES] ?? `.env.${stage}`;

dotenv.config({ path: envFile });

const env = loadServerEnv(process.env);

export default defineConfig({
  breakpoints: true,
  dbCredentials: {
    url: env.DATABASE_URL,
  },
  dialect: "postgresql",
  out: "./drizzle",
  schema: "./src/lib/db/schema/index.ts",
  schemaFilter: ["public"],
  strict: true,
  verbose: true,
});
