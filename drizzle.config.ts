import "dotenv/config";
import { defineConfig } from "drizzle-kit";

export default defineConfig({
  out: "./drizzle",
  schema: "./src/auth/db/schema/index.ts",
  breakpoints: true,
  verbose: true,
  strict: true,
  casing: "snake_case",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_URL || "",
  },
});
