import { neon, Pool } from "@neondatabase/serverless";
import { drizzle as drizzleNeon } from "drizzle-orm/neon-http";
import { drizzle as drizzlePg } from "drizzle-orm/node-postgres";
import { envServer } from "../env/server";
import * as schema from "./schema";

let pool: Pool | null = null;

/**
 * Singleton for the TCP Connection Pool.
 * Used by Kysely and Better Auth.
 * @neondatabase/serverless Pool is a drop-in replacement for pg.Pool
 * and works with both local Postgres and Neon.
 */
export const getPoolSingleton = () => {
  if (pool) return pool;

  pool = new Pool({
    connectionString: envServer.DATABASE_URL,
  });

  pool.on("error", (err: Error) => {
    console.error("Unexpected error on idle client", err);
  });
  return pool;
};

/**
 * The Drizzle instance.
 * Switches between HTTP (Neon) in production and TCP (pg) in development.
 */
export const db =
  envServer.NODE_ENV === "production"
    ? drizzleNeon({ client: neon(envServer.DATABASE_URL), schema })
    : drizzlePg({ client: getPoolSingleton(), schema });
