import { Pool as NeonPool, neon } from "@neondatabase/serverless";
import { drizzle as drizzleNeon } from "drizzle-orm/neon-http";
import { drizzle as drizzleNode } from "drizzle-orm/node-postgres";
import { Effect } from "effect";
import { Pool as PgPool } from "pg";

import { envInfra } from "../env/infra";
import { envServer } from "../env/server";

// "local" is the developer's Docker Postgres (`nub run dev:local`); "e2e" is
// the Playwright webServer pointing at the same local Postgres, kept distinct
// so the e2e auth bypass in session.effect.ts stays unreachable from dev runs.
export const isLocal =
  envInfra.databaseDriver === "local" || envInfra.databaseDriver === "e2e";

let pool: PgPool | NeonPool | null = null;

function getPool(): PgPool | NeonPool {
  if (pool) {
    return pool;
  }

  pool = isLocal
    ? new PgPool({ connectionString: envServer.DATABASE_URL })
    : new NeonPool({ connectionString: envServer.DATABASE_URL });

  pool.on("error", (err: Error) => {
    Effect.runSync(Effect.logError("Unexpected error on database client", err));
  });

  return pool;
}

export const db = isLocal
  ? drizzleNode({
      // SAFETY: getPool() constructs a PgPool exactly when DATABASE_DRIVER=local
      // (isLocal), so this client is always the PgPool node-postgres expects.
      client: getPool() as PgPool,
    })
  : drizzleNeon({ client: neon(envServer.DATABASE_URL) });

export const getKyselyPool = () => getPool();
