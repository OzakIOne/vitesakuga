import { resolve } from "node:path";

import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";
import { Kysely } from "kysely";

import type { DB } from "./kysely";
import { PGliteDialect } from "./pglite-driver";
import * as schema from "./schema";

let e2eKysely: Kysely<DB> | null = null;

export const createE2EKysely = async (): Promise<Kysely<DB>> => {
  if (e2eKysely) {
    return e2eKysely;
  }

  const pg = await PGlite.create("memory://");
  const drizzleDb = drizzle(pg, { schema });

  const migrationsFolder = resolve(process.cwd(), "drizzle");
  await migrate(drizzleDb, { migrationsFolder });

  e2eKysely = new Kysely<DB>({ dialect: new PGliteDialect(pg) });
  return e2eKysely;
};
