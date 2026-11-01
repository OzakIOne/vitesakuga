import type { Generated } from "kysely";

import type { Role } from "../auth/roles";
import type { DB } from "./kysely";

type Equals<A, B> =
  (<T>() => T extends A ? 1 : 2) extends <T>() => T extends B ? 1 : 2
    ? true
    : false;

type Expect<T extends true> = T;

export type KyselySchemaChecks = [
  Expect<Equals<DB["playlists"]["is_public"], Generated<boolean>>>,
  Expect<Equals<DB["tags"]["id"], Generated<number>>>,
  Expect<Equals<DB["playlists"]["description"], string | null>>,
  Expect<Equals<DB["saved_searches"]["tags"], string[]>>,
  Expect<Equals<DB["user"]["role"], Generated<Role>>>,
];
