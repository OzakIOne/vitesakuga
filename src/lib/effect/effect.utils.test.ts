import { PGlite } from "@electric-sql/pglite";
import { Effect } from "effect";
import { Kysely, sql } from "kysely";
import { describe, expect, it } from "vitest";

import type { DB } from "../db/kysely";
import { PGliteDialect } from "../db/pglite-driver";
import { makeFromKysely } from "./effect.utils";

const createKysely = async () => {
  const pg = await PGlite.create("memory://");
  return new Kysely<DB>({ dialect: new PGliteDialect(pg) });
};

describe("makeFromKysely", () => {
  it("is idempotent when applied multiple times to the same instance", async () => {
    const kysely = await createKysely();

    const first = makeFromKysely(kysely);
    const second = makeFromKysely(kysely);

    expect(second).toBe(first);

    const rows = await Effect.runPromise(
      second.transaction().execute((trx) =>
        Effect.gen(function* () {
          yield* trx.execute(
            sql`create table playlist_posts (id serial primary key)`,
          );
          yield* trx.execute(sql`insert into playlist_posts default values`);
          return yield* trx.execute(sql`select * from playlist_posts`);
        }),
      ),
    );

    expect(rows).toHaveLength(1);
  });
});
