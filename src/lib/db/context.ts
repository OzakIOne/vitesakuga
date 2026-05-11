import { Context } from "effect";
import type { Kysely } from "kysely";

import type { DB } from "./kysely";

export class KyselyDB extends Context.Service<KyselyDB, Kysely<DB>>()(
  "KyselyDB",
) {}
