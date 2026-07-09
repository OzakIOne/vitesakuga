import { Pool as NeonPool, neon } from "@neondatabase/serverless";
import { drizzle as drizzleNeon } from "drizzle-orm/neon-http";
import { drizzle as drizzleNode } from "drizzle-orm/node-postgres";
import { Effect } from "effect";
import { Pool as PgPool } from "pg";

import { envServer } from "../env/server";
import * as schema from "./schema";

const isLocal = process.env["DATABASE_DRIVER"] === "local";

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
  ? drizzleNode({ client: getPool() as PgPool, schema })
  : drizzleNeon({ client: neon(envServer.DATABASE_URL), schema });

export const getKyselyPool = () => getPool();
