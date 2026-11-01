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

export const kysely = isLocal
  ? new Kysely<DB>({
      dialect: new PostgresDialect({
        // SAFETY: getKyselyPool() creates a PgPool exactly when DATABASE_DRIVER=local
        // (isLocal), so this pool is always the PgPool PostgresDialect requires.
        pool: getKyselyPool() as PgPool,
      }),
    })
  : new Kysely<DB>({
      dialect: new NeonTransactionDialect({
        neon: neon(envServer.DATABASE_URL),
        connectionString: envServer.DATABASE_URL,
      }),
    });
