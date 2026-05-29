import { Pool, neon } from "@neondatabase/serverless";
import { drizzle as drizzleNeon } from "drizzle-orm/neon-http";
import { Effect } from "effect";

import { envServer } from "../env/server";
import * as schema from "./schema";

let neonPool: Pool | null = null;

/**
 * Singleton for Neon Serverless Pool (Neon HTTP Development/Production)
 * Used by Drizzle in Neon environments
 */
export const getNeonPoolSingleton = (): Pool => {
  if (neonPool) {
    return neonPool;
  }

  neonPool = new Pool({
    connectionString: envServer.DATABASE_URL,
  });

  neonPool.on("error", (err: Error) => {
    Effect.runSync(Effect.logError("Unexpected error on Neon client", err));
  });

  return neonPool;
};

export const db = drizzleNeon({ client: neon(envServer.DATABASE_URL), schema });

/**
 * Get the appropriate Kysely pool
 * - Local: postgres-js pool (getTcpPoolSingleton)
 * - Neon: Neon serverless pool (getNeonPoolSingleton)
 */
export const getKyselyPool = () => getNeonPoolSingleton();
