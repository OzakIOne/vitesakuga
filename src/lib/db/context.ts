import { Context } from "effect";

import type { EffectKysely } from "../effect/effect.utils";
import type { DB } from "./kysely";

export class KyselyDB extends Context.Service<KyselyDB, EffectKysely<DB>>()(
  "KyselyDB",
) {}
