import { PGlite } from "@electric-sql/pglite";
import { Effect, Exit, Option, Schema } from "effect";
import { Kysely, sql } from "kysely";
import { afterEach, describe, expect, it } from "vitest";

import type { DB } from "../db/kysely";
import { PGliteDialect } from "../db/pglite-driver";
import { makeFromKysely, SqlError } from "./effect.utils";

const createdPgs: PGlite[] = [];

const createKysely = async () => {
  const pg = await PGlite.create("memory://");
  createdPgs.push(pg);
  return new Kysely<DB>({ dialect: new PGliteDialect(pg) });
};

afterEach(async () => {
  const pgs = [...createdPgs];
  createdPgs.length = 0;
  await Promise.all(pgs.map((pg) => pg.close()));
});

class RollbackSignal extends Schema.TaggedError<RollbackSignal>()(
  "RollbackSignal",
  {},
) {}

const flipFailure = async <E>(effect: Effect.Effect<unknown, E>) =>
  Effect.runPromise(Effect.flip(effect));

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

  describe("execute failure paths", () => {
    it("maps a SQL failure to SqlError with cause preserved and the compiled SQL in the message", async () => {
      const kysely = await createKysely();
      const db = makeFromKysely(kysely);
      const query = kysely.selectFrom("tags").selectAll();
      const compiledSql = query.compile().sql;

      const error = (await flipFailure(db.execute(query))) as SqlError;

      expect(error._tag).toBe("SqlError");
      expect(error).toBeInstanceOf(SqlError);
      expect(error.cause).toBeInstanceOf(Error);
      expect(error.cause).toMatchObject({
        message: expect.stringContaining("tags"),
      });
      expect(error.message).toContain(compiledSql);
      expect(error.message).toContain("[execute]");
    });

    it("maps a raw SQL failure to SqlError with the raw query in the message", async () => {
      const kysely = await createKysely();
      const db = makeFromKysely(kysely);
      const query = sql`select * from nonexistent_table_xyz`;
      const compiledSql = query.compile(kysely).sql;

      const error = (await flipFailure(db.executeRaw(query))) as SqlError;

      expect(error._tag).toBe("SqlError");
      expect(error.cause).toBeInstanceOf(Error);
      expect(error.message).toContain(compiledSql);
      expect(error.message).toContain("[executeRaw]");
    });
  });

  describe("transaction rollback", () => {
    it("propagates the original typed error and discards writes made inside the transaction", async () => {
      const kysely = await createKysely();
      const db = makeFromKysely(kysely);
      await Effect.runPromise(
        db.executeRaw(
          sql`create table rollback_test (id serial primary key, name text)`,
        ),
      );

      const failure = new RollbackSignal();

      const error = await flipFailure(
        db.transaction().execute((trx) =>
          Effect.gen(function* () {
            yield* trx.execute(
              sql`insert into rollback_test (name) values (${"lost"})`,
            );
            return yield* Effect.fail(failure);
          }),
        ),
      );

      expect(error).toBe(failure);
      expect((error as RollbackSignal)._tag).toBe("RollbackSignal");

      const rows = await Effect.runPromise(
        db.execute(sql`select * from rollback_test`),
      );
      expect(rows).toHaveLength(0);
    });

    it("commits writes when the transaction effect succeeds", async () => {
      const kysely = await createKysely();
      const db = makeFromKysely(kysely);
      await Effect.runPromise(
        db.executeRaw(
          sql`create table commit_test (id serial primary key, name text)`,
        ),
      );

      const inserted = await Effect.runPromise(
        db
          .transaction()
          .execute((trx) =>
            trx.execute(sql`insert into commit_test (name) values (${"kept"})`),
          ),
      );
      expect(inserted).toEqual([]);

      const rows = await Effect.runPromise(
        db.execute(sql`select * from commit_test`),
      );
      expect(rows).toHaveLength(1);
    });
  });

  describe("first-row helpers", () => {
    const setupTable = async (db: ReturnType<typeof makeFromKysely<DB>>) => {
      await Effect.runPromise(
        db.executeRaw(
          sql`create table first_row_test (id serial primary key, name text)`,
        ),
      );
    };

    it("executeTakeFirstOption returns Option.none on empty results", async () => {
      const kysely = await createKysely();
      const db = makeFromKysely(kysely);
      await setupTable(db);

      const result = await Effect.runPromise(
        db.executeTakeFirstOption(
          kysely.selectFrom("first_row_test").selectAll(),
        ),
      );

      expect(Option.isNone(result)).toBe(true);
    });

    it("executeTakeFirstOption returns Option.some with the first row on hits", async () => {
      const kysely = await createKysely();
      const db = makeFromKysely(kysely);
      await setupTable(db);
      await Effect.runPromise(
        db.executeRaw(
          sql`insert into first_row_test (name) values (${"a"}), (${"b"})`,
        ),
      );

      const result = await Effect.runPromise(
        db.executeTakeFirstOption(
          kysely.selectFrom("first_row_test").selectAll(),
        ),
      );

      expect(Option.isSome(result)).toBe(true);
      expect(Option.getOrThrow(result)).toMatchObject({ name: "a" });
    });

    it("executeTakeFirstOrUndefined returns undefined on empty results and the row on hits", async () => {
      const kysely = await createKysely();
      const db = makeFromKysely(kysely);
      await setupTable(db);
      const query = kysely.selectFrom("first_row_test").selectAll();

      expect(
        await Effect.runPromise(db.executeTakeFirstOrUndefined(query)),
      ).toBeUndefined();

      await Effect.runPromise(
        db.executeRaw(sql`insert into first_row_test (name) values (${"hit"})`),
      );
      expect(
        await Effect.runPromise(db.executeTakeFirstOrUndefined(query)),
      ).toMatchObject({
        name: "hit",
      });
    });

    it("executeTakeFirstOrError fails with SqlNoFirstResult on empty results", async () => {
      const kysely = await createKysely();
      const db = makeFromKysely(kysely);
      await setupTable(db);

      const error = (await flipFailure(
        db.executeTakeFirstOrError(
          kysely.selectFrom("first_row_test").selectAll(),
        ),
      )) as { _tag?: string };

      expect(error._tag).toBe("SqlNoFirstResult");
    });

    it("executeTakeFirstOrError returns the first row on hits", async () => {
      const kysely = await createKysely();
      const db = makeFromKysely(kysely);
      await setupTable(db);
      await Effect.runPromise(
        db.executeRaw(
          sql`insert into first_row_test (name) values (${"first"})`,
        ),
      );

      const row = await Effect.runPromise(
        db.executeTakeFirstOrError(
          kysely.selectFrom("first_row_test").selectAll(),
        ),
      );

      expect(row).toMatchObject({ name: "first" });
    });

    it("executeTakeFirstUnsafe returns the first row on hits", async () => {
      const kysely = await createKysely();
      const db = makeFromKysely(kysely);
      await setupTable(db);
      await Effect.runPromise(
        db.executeRaw(
          sql`insert into first_row_test (name) values (${"unsafe"})`,
        ),
      );

      const row = await Effect.runPromise(
        db.executeTakeFirstUnsafe(
          kysely.selectFrom("first_row_test").selectAll(),
        ),
      );

      expect(row).toMatchObject({ name: "unsafe" });
    });
  });

  describe("RawBuilder input through execute", () => {
    it("executes a kysely sql template and returns its rows", async () => {
      const kysely = await createKysely();
      const db = makeFromKysely(kysely);

      const rows = await Effect.runPromise(
        db.execute(sql<{ one: number }>`select 1 as one`),
      );

      expect(rows).toEqual([{ one: 1 }]);
    });

    it("executes a kysely sql template through a transaction", async () => {
      const kysely = await createKysely();
      const db = makeFromKysely(kysely);

      const rows = await Effect.runPromise(
        db
          .transaction()
          .execute((trx) => trx.execute(sql<{ one: number }>`select 1 as one`)),
      );

      expect(rows).toEqual([{ one: 1 }]);
    });
  });
});
