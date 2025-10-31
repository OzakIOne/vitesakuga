import { Pool } from "pg";
import { envServer } from "../env/server";

let pool: Pool | null = null;

export const getPoolSingleton = () => {
  if (pool) return pool;

  pool = new Pool({
    database: envServer.POSTGRES_DB,
    user: envServer.POSTGRES_USER,
    password: envServer.POSTGRES_PASSWORD,
    host: envServer.POSTGRES_HOST,
    port: 5432,
    // max: env.DATABASE_MAX_CONNECTIONS,
    // min: env.DATABASE_MIN_CONNECTIONS,
    // Production optimizations
    // idleTimeoutMillis: 30000,
    // connectionTimeoutMillis: 10000,
    // ssl: env.NODE_ENV === "production" ? { rejectUnauthorized: false } : false,
  });

  pool.on("error", (err) => {
    console.error("Unexpected error on idle client", err);
  });
  return pool;
};
