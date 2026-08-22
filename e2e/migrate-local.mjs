import { resolve } from "node:path";

import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { Pool } from "pg";

const databaseUrl = process.env["DATABASE_URL"];
if (!databaseUrl) {
  throw new Error("DATABASE_URL is required");
}

const pool = new Pool({ connectionString: databaseUrl });

try {
  const db = drizzle({ client: pool });
  await migrate(db, {
    migrationsFolder: resolve(import.meta.dirname, "..", "drizzle"),
  });
  // The database-backed rate limiter (window 3600s for sign-up) would
  // otherwise accumulate across e2e runs in the persistent local Postgres.
  await pool.query('TRUNCATE TABLE "rateLimit"');
  console.log("Database migrations applied");
} finally {
  await pool.end();
}
