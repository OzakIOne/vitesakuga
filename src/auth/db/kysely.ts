import { Kysely, PostgresDialect } from "kysely";
import pkg from "pg";
const { Pool } = pkg;
import type { DatabaseSchema } from "./schema/sakuga.schema.js"; // Your defined schema types

export const kysely = new Kysely<DatabaseSchema>({
  dialect: new PostgresDialect({
    pool: new Pool({
      database: process.env.POSTGRES_DB,
      user: process.env.POSTGRES_USER,
      password: process.env.POSTGRES_PASSWORD,
      host: process.env.POSTGRES_HOST,
      port: 5432,
    }),
  }),
});
