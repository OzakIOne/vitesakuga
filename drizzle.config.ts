import * as dotenv from "dotenv";
import { defineConfig } from "drizzle-kit";

import { loadServerEnv } from "./src/lib/env/defs";

const ENV_FILES: Record<string, string> = {
  development: ".env",
  dev: ".env",
  production: ".env.production",
  prod: ".env.production",
  local: ".env.test",
  test: ".env.test",
};

const stage = process.env["STAGE"] ?? "development";
const envFile = ENV_FILES[stage] ?? `.env.${stage}`;

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
