import type { Kyselify } from "drizzle-orm/kysely";
import { Kysely, PostgresDialect } from "kysely";
import { getKyselyPool } from "./pool";
import type * as authschema from "./schema/auth.schema";
import type * as sakugaschema from "./schema/sakuga.schema";

type DrizzleSchema = typeof sakugaschema & typeof authschema;

// Extract table name and convert to Kyselify
type KyselyDB<T extends Record<string, any>> = {
  [K in keyof T as T[K] extends { _: { name: infer Name } }
    ? Name extends string
      ? Name
      : never
    : never]: T[K] extends { _: any } ? Kyselify<T[K]> : never;
};

type DB = KyselyDB<DrizzleSchema>;

// export interface DB {
//   account: Kyselify<DrizzleSchema["account"]>;
//   session: Kyselify<DrizzleSchema["session"]>;
//   user: Kyselify<DrizzleSchema["user"]>;
//   verification: Kyselify<DrizzleSchema["verification"]>;
//   comments: Kyselify<DrizzleSchema["comments"]>;
//   posts: Kyselify<DrizzleSchema["posts"]>;
//   tags: Kyselify<DrizzleSchema["tags"]>;
//   post_tags: Kyselify<DrizzleSchema["postTags"]>;
// }

export const kysely = new Kysely<DB>({
  dialect: new PostgresDialect({
    pool: getKyselyPool(),
  }),
});
