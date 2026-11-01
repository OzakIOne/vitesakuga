import { getTableColumns, getTableName, is } from "drizzle-orm";
import { PgTable } from "drizzle-orm/pg-core";
import { expect, it } from "vitest";

import * as schema from "./index";

// Kysely's `DB` type is derived from these tables by TypeScript key
// (src/lib/db/kysely-schema.ts), so every key must equal its database column.
it("names every Drizzle table key after its database column", () => {
  const mismatches = Object.values(schema)
    .filter((exported) => is(exported, PgTable))
    .flatMap((table) =>
      Object.entries(getTableColumns(table))
        .filter(([key, column]) => key !== column.name)
        .map(
          ([key, column]) => `${getTableName(table)}.${key} -> ${column.name}`,
        ),
    );

  expect(
    mismatches,
    "Name the Drizzle TS key after its database column (for example `created_at: timestamp()`), because Kysely types are derived by key",
  ).toEqual([]);
});
