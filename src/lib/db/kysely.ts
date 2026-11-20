import { neon } from "@neondatabase/serverless";
import { Effect } from "effect";
import { Kysely, PostgresDialect, type Dialect } from "kysely";
import { Pool as PgPool } from "pg";

import { envInfra } from "../env/infra";
import { envServer } from "../env/server";
import type { KyselyTable, SchemaTable } from "./kysely-schema";
import { NeonTransactionDialect } from "./neon-transaction-dialect";

export type DB = {
  [Table in SchemaTable as Table["_"]["name"]]: KyselyTable<Table>;
};

const createLocalPool = () => {
  const pool = new PgPool({ connectionString: envServer.DATABASE_URL });
  pool.on("error", (err: Error) => {
    Effect.runSync(Effect.logError("Unexpected error on database client", err));
  });
  return pool;
};

const createKyselyDialect = (): Dialect => {
  switch (envInfra.databaseDriver) {
    case "local":
    case "e2e":
      return new PostgresDialect({ pool: createLocalPool() });
    case "neon":
    case "pglite":
      return new NeonTransactionDialect({
        neon: neon(envServer.DATABASE_URL),
        connectionString: envServer.DATABASE_URL,
      });
  }
};

const kyselyDialect = createKyselyDialect();

export const kysely = new Kysely<DB>({ dialect: kyselyDialect });

// Better Auth calls `transaction()` on the instance it is given. The shared
// `kysely` is wrapped by `makeFromKysely` (layer-factories.server.ts), which
// replaces that method with the Effect transaction API, so Better Auth gets its
// own unwrapped instance over the same dialect and pool.
export const authKysely = new Kysely<DB>({ dialect: kyselyDialect });
