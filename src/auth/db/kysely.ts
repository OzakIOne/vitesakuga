import { Kysely, PostgresDialect } from "kysely";
import { getPoolSingleton } from "./pool";

import * as sakugaschema from "./schema/sakuga.schema";
import * as authschema from "./schema/auth.schema";

import type { Kyselify } from "drizzle-orm/kysely";

type DrizzleSchema = typeof sakugaschema & typeof authschema;

export interface DB {
  account: Kyselify<DrizzleSchema["account"]>;
  session: Kyselify<DrizzleSchema["session"]>;
  user: Kyselify<DrizzleSchema["user"]>;
  verification: Kyselify<DrizzleSchema["verification"]>;
  comments: Kyselify<DrizzleSchema["comments"]>;
  posts: Kyselify<DrizzleSchema["posts"]>;
  tags: Kyselify<DrizzleSchema["tags"]>;
  postTags: Kyselify<DrizzleSchema["postTags"]>;
}

export const kysely = new Kysely<DB>({
  dialect: new PostgresDialect({
    pool: getPoolSingleton(),
  }),
});
