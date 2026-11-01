import { neon } from "@neondatabase/serverless";
import { Kysely, PostgresDialect } from "kysely";
import { Pool as PgPool } from "pg";

import { envServer } from "../env/server";
import type { KyselyTable, SchemaTable } from "./kysely-schema";
import { NeonTransactionDialect } from "./neon-transaction-dialect";
import { getKyselyPool, isLocal } from "./pool";

export type DB = {
  [Table in SchemaTable as Table["_"]["name"]]: KyselyTable<Table>;
};

const kyselyDialect = isLocal
  ? new PostgresDialect({
      // SAFETY: getKyselyPool() creates a PgPool exactly when DATABASE_DRIVER=local
      // (isLocal), so this pool is always the PgPool PostgresDialect requires.
      pool: getKyselyPool() as PgPool,
    })
  : new NeonTransactionDialect({
      neon: neon(envServer.DATABASE_URL),
      connectionString: envServer.DATABASE_URL,
    });

export const kysely = new Kysely<DB>({ dialect: kyselyDialect });

// Better Auth calls `transaction()` on the instance it is given. The shared
// `kysely` is wrapped by `makeFromKysely` (layer-factories.server.ts), which
// replaces that method with the Effect transaction API, so Better Auth gets its
// own unwrapped instance over the same dialect and pool.
export const authKysely = new Kysely<DB>({ dialect: kyselyDialect });
