import { PGlite } from "@electric-sql/pglite";
import { Kysely, sql } from "kysely";
import { afterEach, describe, expect, it } from "vitest";

import type { DB } from "./kysely";
import { PGliteDialect } from "./pglite-driver";

const createdPgs: PGlite[] = [];

const createKysely = async (
  hooks: ConstructorParameters<typeof PGliteDialect>[1] = {},
) => {
  const pg = await PGlite.create("memory://");
  createdPgs.push(pg);
  const db = new Kysely<DB>({ dialect: new PGliteDialect(pg, hooks) });
  await db.executeQuery(
    sql`create table driver_phase_test (id serial primary key, value text)`.compile(
      db,
    ),
  );
  return db;
};

afterEach(async () => {
  const pgs = [...createdPgs];
  createdPgs.length = 0;
  await Promise.all(pgs.map((pg) => pg.close()));
});

describe("PGliteDialect transaction phase metadata", () => {
  it("reports a BEGIN rejection as an unknown transaction outcome", async () => {
    const beginFailure = new Error("begin failed");
    const db = await createKysely({
      beginTransaction: () => Promise.reject(beginFailure),
    });

    await expect(
      db.transaction().execute(async () => []),
    ).rejects.toMatchObject({
      _tag: "SqlError",
      cause: beginFailure,
      outcome: "unknown",
      stage: "begin",
    });
  });

  it("reports a rejected COMMIT as unknown even when rollback succeeds", async () => {
    const commitFailure = new Error("commit failed");
    let observedOutcome;
    const db = await createKysely({
      commitTransaction: () => Promise.reject(commitFailure),
      releaseConnection: (outcome) => {
        observedOutcome = outcome;
      },
    });

    await expect(
      db.transaction().execute(async (trx) => {
        await trx
          .insertInto("driver_phase_test" as never)
          .values({ value: "value" })
          .execute();
        return [];
      }),
    ).rejects.toMatchObject({
      _tag: "SqlError",
      cause: commitFailure,
      outcome: "unknown",
      stage: "commit",
    });
    expect(observedOutcome).toBe("unknown");
  });

  it("reports release failure separately after COMMIT is confirmed", async () => {
    const releaseFailure = new Error("release failed");
    let observedOutcome;
    const db = await createKysely({
      releaseConnection: (outcome) => {
        observedOutcome = outcome;
        return outcome === undefined
          ? undefined
          : Promise.reject(releaseFailure);
      },
    });

    await expect(
      db.transaction().execute(async (trx) => {
        await trx
          .insertInto("driver_phase_test" as never)
          .values({ value: "value" })
          .execute();
        return [];
      }),
    ).rejects.toMatchObject({
      _tag: "SqlError",
      cause: releaseFailure,
      outcome: "commit-confirmed",
      stage: "release",
    });
    expect(observedOutcome).toBe("commit-confirmed");

    const rows = await db.executeQuery(
      sql`select * from driver_phase_test`.compile(db),
    );
    expect(rows.rows).toHaveLength(1);
  });
});
