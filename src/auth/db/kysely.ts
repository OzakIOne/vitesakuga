import { CamelCasePlugin, Kysely, PostgresDialect } from "kysely";
import pkg from "pg";
import { DbSchemaInsert } from "./schema";
const { Pool } = pkg;

export const kysely = new Kysely<DbSchemaInsert>({
  dialect: new PostgresDialect({
    pool: new Pool({
      database: process.env.POSTGRES_DB,
      user: process.env.POSTGRES_USER,
      password: process.env.POSTGRES_PASSWORD,
      host: process.env.POSTGRES_HOST,
      port: 5432,
    }),
  }),
  plugins: [new CamelCasePlugin()],
});
