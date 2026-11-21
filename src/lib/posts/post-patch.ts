import type { Effect } from "effect";

import type { EffectTransaction } from "../db/effect-kysely";
import type { DB } from "../db/kysely";
import {
  updatePostWithVersionInTransaction,
  type LifecycleError,
  type PostVersionResult,
  type UpdatePostWithVersionInput,
} from "../lifecycle/lifecycle.service";

/**
 * Shared Post metadata patch seam used by both direct Post updates and
 * approved Post edit suggestions. Enforces optimistic version CAS inside the
 * caller's transaction.
 */
export const applyPostPatchInTransaction = (
  trx: EffectTransaction<DB>,
  input: UpdatePostWithVersionInput,
): Effect.Effect<PostVersionResult, LifecycleError> =>
  updatePostWithVersionInTransaction(trx, input);
