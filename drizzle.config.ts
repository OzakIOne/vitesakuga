import "dotenv/config";
import { defineConfig } from "drizzle-kit";
import { envServer } from "src/lib/env/server";

export default defineConfig({
  out: "./drizzle",
  schema: "./src/lib/db/schema/index.ts",
  breakpoints: true,
  verbose: true,
  strict: true,
  dialect: "postgresql",
  dbCredentials: {
    url: envServer.DATABASE_URL,
  },
});
