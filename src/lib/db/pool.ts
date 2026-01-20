import { neon, Pool } from "@neondatabase/serverless";
import { drizzle as drizzleNeon } from "drizzle-orm/neon-http";
import { envServer } from "../env/server";
import * as schema from "./schema";

let neonPool: Pool | null = null;

/**
 * Singleton for Neon Serverless Pool (Neon HTTP Development/Production)
 * Used by Drizzle in Neon environments
 */
export const getNeonPoolSingleton = (): Pool => {
  if (neonPool) return neonPool;

  neonPool = new Pool({
    connectionString: envServer.DATABASE_URL,
  });

  neonPool.on("error", (err: Error) => {
    console.error("Unexpected error on Neon client", err);
  });

  return neonPool;
};

export const db = drizzleNeon({ client: neon(envServer.DATABASE_URL), schema });

/**
 * Get the appropriate Kysely pool
 * - Local: postgres-js pool (getTcpPoolSingleton)
 * - Neon: Neon serverless pool (getNeonPoolSingleton)
 */
export const getKyselyPool = () => {
  return getNeonPoolSingleton();
};
