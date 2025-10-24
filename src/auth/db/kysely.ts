import { CamelCasePlugin, Kysely, PostgresDialect } from "kysely";
import { DbSchemaInsert } from "./schema";
import { getPoolSingleton } from "./pool";

export const kysely = new Kysely<DbSchemaInsert>({
  dialect: new PostgresDialect({
    pool: getPoolSingleton(),
  }),
  plugins: [new CamelCasePlugin()],
});
