import "dotenv/config";
import { defineConfig } from "drizzle-kit";
import { envServer } from "./src/lib/env/server";

export default defineConfig({
  breakpoints: true,
  dbCredentials: {
    url: envServer.DATABASE_URL,
  },
  dialect: "postgresql",
  out: "./drizzle",
  schema: "./src/lib/db/schema/index.ts",
  strict: true,
  verbose: true,
});
