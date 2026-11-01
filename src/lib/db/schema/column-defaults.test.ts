import { Layer } from "effect";
import { sql } from "kysely";
import { expect, it } from "vitest";

import { makeServiceTestLayer } from "../test-utils";

const readColumnDefault = (
  db: Awaited<ReturnType<typeof makeServiceTestLayer>>["db"],
  { table, column }: { table: string; column: string },
) =>
  sql<{ column_default: string | null }>`
    select column_default
    from information_schema.columns
    where table_schema = 'public' and table_name = ${table} and column_name = ${column}
  `
    .execute(db)
    .then((result) => result.rows[0]?.column_default ?? null);

it("migrates posts.videoMetadata with the default the Drizzle schema declares", async () => {
  const { db, close } = await makeServiceTestLayer(Layer.empty);
  try {
    expect(
      await readColumnDefault(db, { table: "posts", column: "videoMetadata" }),
    ).toBe("'{}'::json");
  } finally {
    await close();
  }
});

it("migrates video_revisions.videoMetadata without a database default", async () => {
  const { db, close } = await makeServiceTestLayer(Layer.empty);
  try {
    expect(
      await readColumnDefault(db, {
        table: "video_revisions",
        column: "videoMetadata",
      }),
    ).toBeNull();
  } finally {
    await close();
  }
});
