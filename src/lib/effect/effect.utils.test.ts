import { PGlite } from "@electric-sql/pglite";
import { Cause, Context, Effect, Exit, Option, Schema } from "effect";
import { TestClock } from "effect/testing";
import { Kysely, sql } from "kysely";
import { afterEach, describe, expect, it } from "vitest";

import type { DB } from "../db/kysely";
import { PGliteDialect, type PGliteDriverHooks } from "../db/pglite-driver";
import { makeFromKysely, SqlError } from "./effect.utils";

const createdPgs: PGlite[] = [];

const createKysely = async (hooks?: PGliteDriverHooks) => {
  const pg = await PGlite.create("memory://");
  createdPgs.push(pg);
  return new Kysely<DB>({ dialect: new PGliteDialect(pg, hooks) });
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
    it("waits for BEGIN, then rolls back without starting the callback", async () => {
      const beginStarted = Promise.withResolvers<void>();
      const beginGate = Promise.withResolvers<void>();
      let callbackStarted = false;
      const kysely = await createKysely({
        beginTransaction: async () => {
          beginStarted.resolve();
          await beginGate.promise;
        },
      });
      const db = makeFromKysely(kysely);
      await Effect.runPromise(
        db.executeRaw(
          sql`create table interrupt_before_begin_test (id serial primary key)`,
        ),
      );
      const controller = new AbortController();
      const transactionExit = Effect.runPromiseExit(
        db.transaction().execute((trx) => {
          callbackStarted = true;
          return trx.execute(
            sql`insert into interrupt_before_begin_test default values`,
          );
        }),
        { signal: controller.signal },
      );
      let transactionSettled = false;
      const observedTransactionExit = transactionExit.then((exit) => {
        transactionSettled = true;
        return exit;
      });

      await beginStarted.promise;
      controller.abort();
      expect(callbackStarted).toBe(false);
      expect(transactionSettled).toBe(false);

      beginGate.resolve();
      const exit = await observedTransactionExit;
      expect(callbackStarted).toBe(false);
      expect(Exit.isFailure(exit)).toBe(true);
      if (Exit.isFailure(exit)) {
        expect(Cause.hasInterruptsOnly(exit.cause)).toBe(true);
      }

      const rows = await Effect.runPromise(
        db.execute(sql`select * from interrupt_before_begin_test`),
      );
      expect(rows).toHaveLength(0);
    });

    it("waits for SQL, rollback, and release before finishing interruption", async () => {
      const queryStarted = Promise.withResolvers<void>();
      const queryGate = Promise.withResolvers<void>();
      const rollbackStarted = Promise.withResolvers<void>();
      const rollbackGate = Promise.withResolvers<void>();
      const releaseStarted = Promise.withResolvers<void>();
      const releaseGate = Promise.withResolvers<void>();
      const kysely = await createKysely({
        executeQuery: async (query) => {
          if (
            query.sql.trimStart().toLowerCase().startsWith("insert") &&
            query.sql.includes("interrupt_during_query_test")
          ) {
            queryStarted.resolve();
            await queryGate.promise;
          }
        },
        rollbackTransaction: async () => {
          rollbackStarted.resolve();
          await rollbackGate.promise;
        },
        releaseConnection: async (outcome) => {
          if (outcome === undefined) return;
          releaseStarted.resolve();
          await releaseGate.promise;
        },
      });
      const db = makeFromKysely(kysely);
      await Effect.runPromise(
        db.executeRaw(
          sql`create table interrupt_during_query_test (id serial primary key)`,
        ),
      );
      const controller = new AbortController();
      const transactionExit = Effect.runPromiseExit(
        db
          .transaction()
          .execute((trx) =>
            trx.execute(
              sql`insert into interrupt_during_query_test default values`,
            ),
          ),
        { signal: controller.signal },
      );
      let transactionSettled = false;
      const observedTransactionExit = transactionExit.then((exit) => {
        transactionSettled = true;
        return exit;
      });

      await queryStarted.promise;
      controller.abort();
      expect(transactionSettled).toBe(false);

      queryGate.resolve();
      await rollbackStarted.promise;
      expect(transactionSettled).toBe(false);

      rollbackGate.resolve();
      await releaseStarted.promise;
      expect(transactionSettled).toBe(false);

      releaseGate.resolve();
      const exit = await observedTransactionExit;
      expect(Exit.isFailure(exit)).toBe(true);
      if (Exit.isFailure(exit)) {
        expect(Cause.hasInterruptsOnly(exit.cause)).toBe(true);
      }
      const rows = await Effect.runPromise(
        db.execute(sql`select * from interrupt_during_query_test`),
      );
      expect(rows).toHaveLength(0);
    });

    it("interrupts a callback suspended on non-SQL Effect.promise work", async () => {
      const callbackStarted = Promise.withResolvers<void>();
      let insertAttempted = false;
      const kysely = await createKysely();
      const db = makeFromKysely(kysely);
      await Effect.runPromise(
        db.executeRaw(
          sql`create table interrupt_during_promise_test (id serial primary key)`,
        ),
      );
      const controller = new AbortController();
      const transactionExit = Effect.runPromiseExit(
        db.transaction().execute((trx) =>
          Effect.gen(function* () {
            yield* Effect.promise(
              (signal) =>
                new Promise<void>((resolve) => {
                  callbackStarted.resolve();
                  if (signal.aborted) {
                    resolve();
                  } else {
                    signal.addEventListener("abort", () => resolve(), {
                      once: true,
                    });
                  }
                }),
            );
            insertAttempted = true;
            yield* trx.execute(
              sql`insert into interrupt_during_promise_test default values`,
            );
          }),
        ),
        { signal: controller.signal },
      );

      await callbackStarted.promise;
      controller.abort();
      const exit = await transactionExit;

      expect(Exit.isFailure(exit)).toBe(true);
      if (Exit.isFailure(exit)) {
        expect(Cause.hasInterruptsOnly(exit.cause)).toBe(true);
      }
      expect(insertAttempted).toBe(false);
      const rows = await Effect.runPromise(
        db.execute(sql`select * from interrupt_during_promise_test`),
      );
      expect(rows).toHaveLength(0);
    });

    it("preserves the caller's Effect context inside the transaction callback", async () => {
      const kysely = await createKysely();
      const db = makeFromKysely(kysely);

      const now = await Effect.runPromise(
        Effect.gen(function* () {
          yield* TestClock.setTime(1234);
          return yield* db
            .transaction()
            .execute(() =>
              Effect.clockWith((clock) => clock.currentTimeMillis),
            );
        }).pipe(Effect.provide(TestClock.layer())),
      );

      expect(now).toBe(1234);
    });

    it("preserves an arbitrary caller service inside the transaction callback", async () => {
      const kysely = await createKysely();
      const db = makeFromKysely(kysely);
      const RequestId = Context.Service<string>("vitesakuga/test-request-id");

      const requestId = await Effect.runPromise(
        db
          .transaction()
          .execute(() => Effect.service(RequestId))
          .pipe(Effect.provideService(RequestId, "request-123")),
      );

      expect(requestId).toBe("request-123");
    });

    it("preserves the Effect callback when transaction settings are chained", async () => {
      const kysely = await createKysely();
      const db = makeFromKysely(kysely);
      const RequestId = Context.Service<string>("vitesakuga/test-request-id");

      const requestId = await Effect.runPromise(
        db
          .transaction()
          .setIsolationLevel("serializable")
          .setAccessMode("read write")
          .execute(() => Effect.service(RequestId))
          .pipe(Effect.provideService(RequestId, "request-456")),
      );

      expect(requestId).toBe("request-456");
    });

    it("preserves the caller's span inside the transaction callback", async () => {
      const kysely = await createKysely();
      const db = makeFromKysely(kysely);

      const [callerSpan, callbackSpan] = await Effect.runPromise(
        Effect.withSpan(
          Effect.gen(function* () {
            const caller = yield* Effect.currentSpan;
            const callback = yield* db
              .transaction()
              .execute(() => Effect.currentSpan);
            return [caller, callback] as const;
          }),
          "caller-span",
        ),
      );

      expect(callbackSpan.spanId).toBe(callerSpan.spanId);
    });

    it("preserves defects from the transaction callback as defects", async () => {
      const kysely = await createKysely();
      const db = makeFromKysely(kysely);
      const defect = new Error("callback defect");

      const exit = await Effect.runPromiseExit(
        db.transaction().execute(() => Effect.die(defect)),
      );

      expect(Exit.isFailure(exit)).toBe(true);
      if (Exit.isFailure(exit)) {
        const die = Cause.findDie(exit.cause);
        expect(die._tag).toBe("Success");
        if (die._tag === "Success") {
          expect(die.success.defect).toBe(defect);
        }
      }
    });

    it("preserves synchronous callback throws as defects", async () => {
      const kysely = await createKysely();
      const db = makeFromKysely(kysely);
      const defect = new Error("synchronous callback defect");

      const exit = await Effect.runPromiseExit(
        db.transaction().execute(() => {
          throw defect;
        }),
      );

      expect(Exit.isFailure(exit)).toBe(true);
      if (Exit.isFailure(exit)) {
        const die = Cause.findDie(exit.cause);
        expect(die._tag).toBe("Success");
        if (die._tag === "Success") {
          expect(die.success.defect).toBe(defect);
        }
      }
    });

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

    it("reports a rejected commit as unknown instead of as a safe rollback", async () => {
      const commitFailure = new Error("commit failed");
      const kysely = await createKysely({
        commitTransaction: () => Promise.reject(commitFailure),
      });
      const db = makeFromKysely(kysely);
      await Effect.runPromise(
        db.executeRaw(
          sql`create table commit_failure_test (id serial primary key, name text)`,
        ),
      );

      const exit = await Effect.runPromiseExit(
        db
          .transaction()
          .execute((trx) =>
            trx.execute(
              sql`insert into commit_failure_test (name) values (${"unknown"})`,
            ),
          ),
      );

      expect(Exit.isFailure(exit)).toBe(true);
      if (Exit.isFailure(exit)) {
        const failure = Cause.findError(exit.cause);
        expect(failure._tag).toBe("Success");
        if (failure._tag === "Success") {
          expect(failure.success).toMatchObject({
            _tag: "SqlError",
            outcome: "unknown",
            stage: "commit",
          });
        }
      }
      const rows = await Effect.runPromise(
        db.execute(sql`select * from commit_failure_test`),
      );
      expect(rows).toHaveLength(0);
    });

    it("treats a release failure after a confirmed commit as cleanup only", async () => {
      const releaseFailure = new Error("release failed");
      let observedOutcome;
      const kysely = await createKysely({
        releaseConnection: (outcome) => {
          observedOutcome = outcome;
          return outcome === undefined
            ? undefined
            : Promise.reject(releaseFailure);
        },
      });
      const db = makeFromKysely(kysely);
      await Effect.runPromise(
        db.executeRaw(
          sql`create table release_failure_test (id serial primary key, name text)`,
        ),
      );

      const exit = await Effect.runPromiseExit(
        db
          .transaction()
          .execute((trx) =>
            trx.execute(
              sql`insert into release_failure_test (name) values (${"kept"})`,
            ),
          ),
      );

      expect(Exit.isSuccess(exit)).toBe(true);
      expect(observedOutcome).toBe("commit-confirmed");
      const rows = await Effect.runPromise(
        db.execute(sql`select * from release_failure_test`),
      );
      expect(rows).toHaveLength(1);
    });

    it("keeps the callback cause when rollback also fails", async () => {
      const rollbackFailure = new Error("rollback failed");
      const kysely = await createKysely({
        rollbackTransaction: () => Promise.reject(rollbackFailure),
      });
      const db = makeFromKysely(kysely);
      await Effect.runPromise(
        db.executeRaw(
          sql`create table rollback_failure_test (id serial primary key, name text)`,
        ),
      );
      const callbackFailure = new RollbackSignal();

      const exit = await Effect.runPromiseExit(
        db.transaction().execute((trx) =>
          Effect.gen(function* () {
            yield* trx.execute(
              sql`insert into rollback_failure_test (name) values (${"lost"})`,
            );
            return yield* Effect.fail(callbackFailure);
          }),
        ),
      );

      expect(Exit.isFailure(exit)).toBe(true);
      if (Exit.isFailure(exit)) {
        expect(Cause.pretty(exit.cause)).toContain("RollbackSignal");
        expect(Cause.pretty(exit.cause)).toContain("rollback failed");
      }
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
    // The table is created ad hoc via raw SQL and is not part of the DB
    // interface; the never-typed alias keeps Kysely's builder happy.
    const firstRowTest = "first_row_test" as never;
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
        db.executeTakeFirstOption(kysely.selectFrom(firstRowTest).selectAll()),
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
        db.executeTakeFirstOption(kysely.selectFrom(firstRowTest).selectAll()),
      );

      expect(Option.isSome(result)).toBe(true);
      expect(Option.getOrThrow(result)).toMatchObject({ name: "a" });
    });

    it("executeTakeFirstOrUndefined returns undefined on empty results and the row on hits", async () => {
      const kysely = await createKysely();
      const db = makeFromKysely(kysely);
      await setupTable(db);
      const query = kysely.selectFrom(firstRowTest).selectAll();

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
        db.executeTakeFirstOrError(kysely.selectFrom(firstRowTest).selectAll()),
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
        db.executeTakeFirstOrError(kysely.selectFrom(firstRowTest).selectAll()),
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
        db.executeTakeFirstUnsafe(kysely.selectFrom(firstRowTest).selectAll()),
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
