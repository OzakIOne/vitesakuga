import { Effect } from "effect";
import { map, some } from "effect/Array";

import type { EffectTransaction } from "../db/effect-kysely";
import type { DB } from "../db/kysely";
import { LastAdminError } from "../errors";

/**
 * Locks every active admin row and returns their ids. Callers take this lock
 * before reading or changing any role, so two admins who demote each other at
 * the same moment serialize instead of both seeing a second admin.
 */
export const lockActiveAdminIds = Effect.fn("lockActiveAdminIds")(function* (
  executor: EffectTransaction<DB>,
) {
  const rows = yield* executor.execute(
    executor
      .selectFrom("user")
      .select("id")
      .where("role", "=", "admin")
      .where("deletedAt", "is", null)
      .where("suspendedAt", "is", null)
      .forUpdate(),
  );
  return map(rows, (row) => row.id);
});

/**
 * Fails when `departingUserId` is an active admin and no other active admin
 * would remain once it is demoted or deleted.
 */
export const ensureAdminRemains = Effect.fn("ensureAdminRemains")(
  function* (input: {
    readonly activeAdminIds: ReadonlyArray<string>;
    readonly departingUserId: string;
    readonly message: string;
  }) {
    const departsAdmin = input.activeAdminIds.includes(input.departingUserId);
    const otherAdminRemains = some(
      input.activeAdminIds,
      (adminId) => adminId !== input.departingUserId,
    );
    if (!departsAdmin || otherAdminRemains) {
      return;
    }
    return yield* new LastAdminError({ message: input.message });
  },
);
