import type { PgTable } from "drizzle-orm/pg-core";
import type { Generated } from "kysely";

import type * as schema from "./schema";

export type SchemaTable = {
  [Key in keyof typeof schema]: (typeof schema)[Key] extends PgTable
    ? (typeof schema)[Key]
    : never;
}[keyof typeof schema];

type HasDefault<TColumn> = TColumn extends {
  readonly _: { readonly hasDefault: true };
}
  ? true
  : false;

type KyselyColumn<TColumn, TSelect> =
  HasDefault<TColumn> extends true ? Generated<TSelect> : TSelect;

export type KyselyTable<TTable extends SchemaTable> = {
  [
    Key in keyof TTable["$inferSelect"]
  ]: Key extends keyof TTable["_"]["columns"]
    ? KyselyColumn<TTable["_"]["columns"][Key], TTable["$inferSelect"][Key]>
    : never;
};
