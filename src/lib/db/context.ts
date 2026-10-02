import { Context } from "effect";

import type { EffectKysely } from "./effect-kysely";
import type { DB } from "./kysely";

export class KyselyDB extends Context.Service<KyselyDB, EffectKysely<DB>>()(
  "KyselyDB",
) {}
