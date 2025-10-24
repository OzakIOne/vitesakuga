// import { env } from "../../env.config.ts";
import { Pool } from "pg";

let pool: Pool | null = null;

export const getPoolSingleton = () => {
  if (pool) return pool;

  pool = new Pool({
    database: process.env.POSTGRES_DB,
    user: process.env.POSTGRES_USER,
    password: process.env.POSTGRES_PASSWORD,
    host: process.env.POSTGRES_HOST,
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
  pool.on("connect", () => {
    console.log("PostgreSQL client connected");
  });
  return pool;
};
