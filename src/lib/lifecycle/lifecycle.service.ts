import { Clock, Context, Effect, Exit, Layer, Option, Schema } from "effect";
import type { Selectable } from "kysely";
import { sql } from "kysely";

import { KyselyDB } from "../db/context";
import type { DB } from "../db/kysely";
import type {
  MediaObjectKind,
  MediaObjectState,
  MediaOperationKind,
  MediaOperationResult,
  MediaOperationStatus,
} from "../db/schema/sakuga.schema";
import {
  SqlError,
  SqlNoFirstResult,
  type EffectTransition,
} from "../effect/effect.utils";
import {
  isDeterministicMediaKey,
  type DeterministicMediaKind,
} from "../storage/keys";
import { StorageError, StorageModule } from "../storage/storage.module";

export type ClaimOperationInput = {
  readonly kind: MediaOperationKind;
  readonly operationKey: string;
  readonly requestFingerprint: string;
  readonly userId: string;
};

export type OperationSnapshot = {
  readonly completedAt: Date | null;
  readonly createdAt: Date;
  readonly failureCode: string | null;
  readonly fence: number;
  readonly id: string;
  readonly kind: MediaOperationKind;
  readonly operationKey: string;
  readonly requestFingerprint: string;
  readonly result: MediaOperationResult | null;
  readonly status: MediaOperationStatus;
  readonly updatedAt: Date;
  readonly userId: string;
};

export type ClaimOperationResult =
  | {
      readonly fence: number;
      readonly operation: OperationSnapshot;
      readonly operationId: string;
      readonly outcome: "claimed";
    }
  | {
      readonly operation: OperationSnapshot;
      readonly operationId: string;
      readonly outcome: "replayed";
      readonly result: MediaOperationResult | null;
    };

export type ReserveObjectInput = {
  readonly contentLength: number;
  readonly contentType: string;
  readonly fence: number;
  readonly fingerprint: string;
  readonly key: string;
  readonly kind: MediaObjectKind;
  readonly operationId: string;
  readonly userId: string;
};

export type MediaObjectSnapshot = {
  readonly contentLength: number;
  readonly contentType: string;
  readonly createdAt: Date;
  readonly deletingCommittedAt: Date | null;
  readonly fence: number;
  readonly fingerprint: string;
  readonly key: string;
  readonly kind: MediaObjectKind;
  readonly operationId: string;
  readonly state: MediaObjectState;
  readonly updatedAt: Date;
  readonly userId: string;
};

export type ReserveObjectResult = {
  readonly object: MediaObjectSnapshot;
  readonly outcome: "reserved" | "reused";
};

export type ObjectFenceInput = {
  readonly fence: number;
  readonly key: string;
  readonly operationId: string;
};

export type ObjectTransitionResult = {
  readonly object: MediaObjectSnapshot;
  readonly outcome: "changed" | "already-ready" | "already-preparing";
};

export type ObservedObject = {
  readonly contentLength: number;
  readonly contentType: string;
  readonly fingerprint: string;
};

export type MarkReadyInput = ObjectFenceInput & {
  readonly observed?: ObservedObject;
};

export type FinishOperationInput = {
  readonly fence: number;
  readonly operationId: string;
  readonly result: MediaOperationResult;
};

export type FinishOperationResult = {
  readonly operation: OperationSnapshot;
  readonly outcome: "completed" | "replayed";
  readonly result: MediaOperationResult | null;
};

export type FailOperationInput = {
  readonly failureCode: string;
  readonly fence: number;
  readonly operationId: string;
  readonly result?: MediaOperationResult;
  readonly status: "conflict" | "failed" | "unknown";
};

export type FailOperationResult = {
  readonly operation: OperationSnapshot;
  readonly outcome: "failed" | "marked-unknown" | "replayed";
  readonly result: MediaOperationResult | null;
};

export type BeginDeleteInput = ObjectFenceInput;

export type BeginDeleteResult = {
  readonly fence: number;
  readonly key: string;
  readonly outcome: "deleting" | "already-deleting" | "protected";
};

export type CompleteDeleteResult = {
  readonly key: string;
  readonly outcome: "deleted" | "already-deleted";
};

export type AdoptObjectInput = ObjectFenceInput & {
  readonly observed: ObservedObject;
};

export type ReconcileInput = {
  readonly operationId?: string;
};

export type ReconcileResult = {
  readonly adoptedKeys: ReadonlyArray<string>;
  readonly completedDeleteKeys: ReadonlyArray<string>;
  readonly inspected: number;
  readonly pendingOperationIds: ReadonlyArray<string>;
  readonly quarantinedKeys: ReadonlyArray<string>;
};

export type UpdatePostWithVersionInput = {
  readonly changes: {
    readonly animeTitle?: string | null;
    readonly chapterNumber?: number | null;
    readonly description?: string;
    readonly episodeNumber?: number | null;
    readonly relatedPostId?: number | null;
    readonly seasonNumber?: number | null;
    readonly source?: string | null;
    readonly sourceType?: "movie" | "tv_series" | null;
    readonly title?: string;
    readonly volumeNumber?: number | null;
  };
  readonly expectedVersion: number;
  readonly ownerUserId?: string;
  readonly postId: number;
};

export type PostVersionResult = {
  readonly postId: number;
  readonly version: number;
};

export type CompareAndIncrementPostVersionInput = {
  readonly expectedVersion: number;
  readonly ownerUserId?: string;
  readonly postId: number;
};

export class LifecycleInputError extends Schema.TaggedError<LifecycleInputError>()(
  "LifecycleInputError",
  { message: Schema.String },
) {}

export class OperationConflictError extends Schema.TaggedError<OperationConflictError>()(
  "OperationConflictError",
  {
    message: Schema.String,
    operationKey: Schema.String,
  },
) {}

export class OperationFenceError extends Schema.TaggedError<OperationFenceError>()(
  "OperationFenceError",
  {
    message: Schema.String,
    operationId: Schema.String,
  },
) {}

export class LifecycleStateError extends Schema.TaggedError<LifecycleStateError>()(
  "LifecycleStateError",
  {
    message: Schema.String,
    resourceId: Schema.String,
  },
) {}

export class ObjectNotFoundError extends Schema.TaggedError<ObjectNotFoundError>()(
  "ObjectNotFoundError",
  {
    key: Schema.String,
    message: Schema.String,
  },
) {}

export class ObjectConflictError extends Schema.TaggedError<ObjectConflictError>()(
  "ObjectConflictError",
  { message: Schema.String },
) {}

export class ObjectNotAdoptableError extends Schema.TaggedError<ObjectNotAdoptableError>()(
  "ObjectNotAdoptableError",
  {
    key: Schema.String,
    message: Schema.String,
  },
) {}

export class ObjectProtectedError extends Schema.TaggedError<ObjectProtectedError>()(
  "ObjectProtectedError",
  {
    key: Schema.String,
    message: Schema.String,
  },
) {}

export class OperationNotReadyError extends Schema.TaggedError<OperationNotReadyError>()(
  "OperationNotReadyError",
  {
    message: Schema.String,
    operationId: Schema.String,
  },
) {}

export class PostVersionConflictError extends Schema.TaggedError<PostVersionConflictError>()(
  "PostVersionConflictError",
  {
    actualVersion: Schema.Number,
    expectedVersion: Schema.Number,
    message: Schema.String,
    postId: Schema.Number,
  },
) {}

export class PostNotFoundForVersionError extends Schema.TaggedError<PostNotFoundForVersionError>()(
  "PostNotFoundForVersionError",
  { message: Schema.String, postId: Schema.Number },
) {}

export type LifecycleError =
  | LifecycleInputError
  | ObjectConflictError
  | ObjectNotAdoptableError
  | ObjectNotFoundError
  | ObjectProtectedError
  | OperationConflictError
  | OperationFenceError
  | OperationNotReadyError
  | PostNotFoundForVersionError
  | PostVersionConflictError
  | LifecycleStateError
  | SqlError
  | SqlNoFirstResult
  | StorageError;

/** The transaction shape accepted by the integration helpers below. */
export type LifecycleTransaction = EffectTransition<DB>;

const isTerminalStatus = (status: MediaOperationStatus): boolean =>
  status === "completed" || status === "conflict" || status === "failed";

const toOperationSnapshot = (
  row: Selectable<DB["media_operations"]>,
): OperationSnapshot => ({
  completedAt: row.completedAt,
  createdAt: row.createdAt,
  failureCode: row.failureCode,
  fence: row.fence,
  id: row.id,
  kind: row.kind,
  operationKey: row.operationKey,
  requestFingerprint: row.requestFingerprint,
  result: row.result,
  status: row.status,
  updatedAt: row.updatedAt,
  userId: row.userId,
});

const toObjectSnapshot = (
  row: Selectable<DB["media_objects"]>,
): MediaObjectSnapshot => ({
  contentLength: row.contentLength,
  contentType: row.contentType,
  createdAt: row.createdAt,
  deletingCommittedAt: row.deletingCommittedAt,
  fence: row.fence,
  fingerprint: row.fingerprint,
  key: row.key,
  kind: row.kind,
  operationId: row.operationId,
  state: row.state,
  updatedAt: row.updatedAt,
  userId: row.userId,
});

const validateClaimInput = (
  input: ClaimOperationInput,
): Effect.Effect<void, LifecycleInputError> => {
  if (input.userId.length === 0 || input.operationKey.length === 0) {
    return Effect.fail(
      new LifecycleInputError({
        message: "Lifecycle operation identity must not be empty",
      }),
    );
  }
  if (input.operationKey.length > 200) {
    return Effect.fail(
      new LifecycleInputError({
        message: "Lifecycle operation key is too long",
      }),
    );
  }
  if (!/^sha256:[0-9a-f]{64}$/.test(input.requestFingerprint)) {
    return Effect.fail(
      new LifecycleInputError({
        message: "Lifecycle request fingerprint must be a SHA-256 digest",
      }),
    );
  }
  return Effect.void;
};

const ensureOperation = (
  trx: LifecycleTransaction,
  operationId: string,
  fence: number,
  now: Date,
): Effect.Effect<OperationSnapshot, LifecycleError> =>
  Effect.gen(function* () {
    const option = yield* trx.executeTakeFirstOption(
      trx
        .selectFrom("media_operations")
        .selectAll()
        .where("id", "=", operationId)
        .forUpdate(),
    );
    if (Option.isNone(option) || option.value.fence !== fence) {
      return yield* new OperationFenceError({
        message: "Lifecycle operation fence is no longer current",
        operationId,
      });
    }
    const operation = toOperationSnapshot(option.value);
    if (isTerminalStatus(operation.status)) {
      return yield* new LifecycleStateError({
        message: "Lifecycle operation is already terminal",
        resourceId: operationId,
      });
    }
    if (operation.status !== "in-progress" && operation.status !== "unknown") {
      return yield* new LifecycleStateError({
        message: "Lifecycle operation is not active",
        resourceId: operationId,
      });
    }
    void now;
    return operation;
  });

const assertObjectInput = (
  input: ReserveObjectInput,
): Effect.Effect<void, LifecycleInputError> => {
  if (
    !isDeterministicMediaKey(input.key) ||
    !input.key.startsWith(`media/${input.kind}/`)
  ) {
    return Effect.fail(
      new LifecycleInputError({
        message: "Managed media keys must come from mediaObjectKey",
      }),
    );
  }
  if (input.contentLength < 0 || !Number.isSafeInteger(input.contentLength)) {
    return Effect.fail(
      new LifecycleInputError({
        message: "Media content length must be a non-negative integer",
      }),
    );
  }
  if (
    input.contentType.length === 0 ||
    input.fingerprint.length === 0 ||
    (input.kind === "video" && !input.contentType.startsWith("video/")) ||
    (input.kind !== "video" && !input.contentType.startsWith("image/")) ||
    (!input.fingerprint.startsWith("sha256:") &&
      !input.fingerprint.startsWith("etag:"))
  ) {
    return Effect.fail(
      new LifecycleInputError({
        message: "Media content type and fingerprint must not be empty",
      }),
    );
  }
  return Effect.void;
};

const validateFailureInput = (
  input: FailOperationInput,
): Effect.Effect<void, LifecycleInputError> => {
  if (
    input.failureCode.length === 0 ||
    input.failureCode.length > 120 ||
    !/^[a-z0-9._-]+$/.test(input.failureCode)
  ) {
    return Effect.fail(
      new LifecycleInputError({
        message: "Lifecycle failure codes must be short stable identifiers",
      }),
    );
  }
  return Effect.void;
};

const validateOperationResult = (
  result: MediaOperationResult | undefined,
): Effect.Effect<void, LifecycleInputError> => {
  if (result === undefined) return Effect.void;
  // SAFETY: MediaOperationResult is the validated lifecycle result object; this view is used only to enumerate its allowed persisted fields.
  // oxlint-disable-next-line anti-slop/no-unsafe-dictionary-type -- the result's values are intentionally checked below before validation.
  const values = result as Readonly<Record<string, unknown>>;
  const allowed = new Set([
    "postId",
    "videoKey",
    "imageKeys",
    "thumbnailKey",
    "state",
  ]);
  for (const [key, value] of Object.entries(values)) {
    if (!allowed.has(key)) {
      return Effect.fail(
        new LifecycleInputError({
          message: "Operation results may contain identifiers and states only",
        }),
      );
    }
    const strings = Array.isArray(value) ? value : [value];
    for (const item of strings) {
      // SAFETY: Array values are validated as primitive lifecycle result entries; only strings can contain URLs or oversized values.
      // oxlint-disable-next-line anti-slop/no-runtime-typeof -- this is the final primitive-domain check for the validated result payload.
      if (
        // oxlint-disable-next-line anti-slop/no-runtime-typeof -- validated lifecycle result entries are checked for string-only URL and size restrictions.
        typeof item === "string" &&
        (/^https?:\/\//i.test(item) || item.length > 512)
      ) {
        return Effect.fail(
          new LifecycleInputError({
            message: "Operation results cannot persist URLs or large values",
          }),
        );
      }
    }
  }
  return Effect.void;
};

const claimInTransaction = (
  trx: LifecycleTransaction,
  input: ClaimOperationInput,
  now: Date,
): Effect.Effect<ClaimOperationResult, LifecycleError> =>
  Effect.gen(function* () {
    // INSERT ... DO NOTHING makes the unique constraint the owner election;
    // a concurrent loser reads the committed row and never fabricates a
    // second operation id.
    // oxlint-disable-next-line effecttsgo/crypto-random-uuid-in-effect -- operation ids are unguessable durable identities and are generated only for a new claim
    const operationId = crypto.randomUUID();
    const inserted = yield* trx.executeTakeFirstOption(
      trx
        .insertInto("media_operations")
        .values({
          fence: 1,
          id: operationId,
          createdAt: now,
          kind: input.kind,
          operationKey: input.operationKey,
          requestFingerprint: input.requestFingerprint,
          result: null,
          status: "in-progress",
          updatedAt: now,
          userId: input.userId,
        })
        .onConflict((oc) => oc.columns(["userId", "operationKey"]).doNothing())
        .returningAll(),
    );

    if (Option.isSome(inserted)) {
      const operation = toOperationSnapshot(inserted.value);
      return {
        fence: operation.fence,
        operation,
        operationId: operation.id,
        outcome: "claimed",
      } as const;
    }

    const existing = yield* trx.executeTakeFirstOption(
      trx
        .selectFrom("media_operations")
        .selectAll()
        .where("userId", "=", input.userId)
        .where("operationKey", "=", input.operationKey)
        .forUpdate(),
    );
    if (Option.isNone(existing)) {
      return yield* new OperationFenceError({
        message: "Lifecycle operation disappeared before it could be claimed",
        operationId,
      });
    }

    const row = existing.value;
    if (
      row.kind !== input.kind ||
      row.requestFingerprint !== input.requestFingerprint
    ) {
      return yield* new OperationConflictError({
        message: "Operation key is already bound to another request",
        operationKey: input.operationKey,
      });
    }

    const operation = toOperationSnapshot(row);
    // A terminal row is authoritative. It is replayed before any caller-side
    // expected-version check, so a lost response cannot become a stale-version
    // error on retry.
    if (isTerminalStatus(operation.status)) {
      return {
        operation,
        operationId: operation.id,
        outcome: "replayed",
        result: operation.result,
      } as const;
    }

    const reclaimed = yield* trx.executeTakeFirstOrError(
      trx
        .updateTable("media_operations")
        .set({
          fence: sql<number>`"fence" + 1`,
          status: "in-progress",
          updatedAt: now,
        })
        .where("id", "=", operation.id)
        .where("userId", "=", input.userId)
        .returningAll(),
    );
    const current = toOperationSnapshot(reclaimed);
    return {
      fence: current.fence,
      operation: current,
      operationId: current.id,
      outcome: "claimed",
    } as const;
  });

const reserveInTransaction = (
  trx: LifecycleTransaction,
  input: ReserveObjectInput,
  now: Date,
): Effect.Effect<ReserveObjectResult, LifecycleError> =>
  Effect.gen(function* () {
    yield* assertObjectInput(input);
    yield* ensureOperation(trx, input.operationId, input.fence, now);

    const existing = yield* trx.executeTakeFirstOption(
      trx
        .selectFrom("media_objects")
        .selectAll()
        .where("key", "=", input.key)
        .forUpdate(),
    );
    if (Option.isNone(existing)) {
      const inserted = yield* trx.executeTakeFirstOrError(
        trx
          .insertInto("media_objects")
          .values({
            contentLength: input.contentLength,
            contentType: input.contentType,
            createdAt: now,
            deletingCommittedAt: null,
            fence: input.fence,
            fingerprint: input.fingerprint,
            key: input.key,
            kind: input.kind,
            operationId: input.operationId,
            state: "reserved",
            updatedAt: now,
            userId: input.userId,
          })
          .returningAll(),
      );
      return {
        object: toObjectSnapshot(inserted),
        outcome: "reserved",
      } as const;
    }

    const row = existing.value;
    const sameIdentity =
      row.operationId === input.operationId &&
      row.userId === input.userId &&
      row.kind === input.kind &&
      row.fingerprint === input.fingerprint &&
      row.contentType === input.contentType &&
      row.contentLength === input.contentLength;
    if (!sameIdentity) {
      // Do not return the existing owner or its fingerprint to another user.
      return yield* new ObjectConflictError({
        message: "Managed media key is already bound to another object",
      });
    }
    if (row.state === "deleting" || row.state === "deleted") {
      return yield* new ObjectNotAdoptableError({
        key: input.key,
        message: "Deleting and deleted media objects are never reusable",
      });
    }
    if (row.state === "unknown") {
      return yield* new ObjectNotAdoptableError({
        key: input.key,
        message: "An unknown media object requires reconciliation first",
      });
    }

    // A reclaimed operation may already have completed the remote upload before
    // its response was lost. Transfer the ready object's fence to the current
    // claim so the retry can safely finish, while the old fence remains stale.
    const current =
      row.fence === input.fence
        ? row
        : yield* trx.executeTakeFirstOrError(
            trx
              .updateTable("media_objects")
              .set({ fence: input.fence, updatedAt: now })
              .where("key", "=", input.key)
              .where("operationId", "=", input.operationId)
              .where("fence", "=", row.fence)
              .returningAll(),
          );
    return {
      object: toObjectSnapshot(current),
      outcome: "reused",
    } as const;
  });

const loadObjectForFence = (
  trx: LifecycleTransaction,
  input: ObjectFenceInput,
): Effect.Effect<Selectable<DB["media_objects"]>, LifecycleError> =>
  Effect.gen(function* () {
    const option = yield* trx.executeTakeFirstOption(
      trx
        .selectFrom("media_objects")
        .selectAll()
        .where("key", "=", input.key)
        .forUpdate(),
    );
    if (Option.isNone(option)) {
      return yield* new ObjectNotFoundError({
        key: input.key,
        message: "Managed media object was not found",
      });
    }
    const row = option.value;
    if (row.operationId !== input.operationId || row.fence !== input.fence) {
      return yield* new OperationFenceError({
        message: "Managed media object fence is no longer current",
        operationId: input.operationId,
      });
    }
    return row;
  });

const checkObservedObject = (
  row: Selectable<DB["media_objects"]>,
  observed: ObservedObject | undefined,
): Effect.Effect<void, ObjectConflictError> => {
  if (observed === undefined) return Effect.void;
  if (
    observed.fingerprint !== row.fingerprint ||
    observed.contentType !== row.contentType ||
    observed.contentLength !== row.contentLength
  ) {
    return Effect.fail(
      new ObjectConflictError({
        message: "Stored object metadata does not match its reserved identity",
      }),
    );
  }
  return Effect.void;
};

const markPreparingInTransaction = (
  trx: LifecycleTransaction,
  input: ObjectFenceInput,
  now: Date,
): Effect.Effect<ObjectTransitionResult, LifecycleError> =>
  Effect.gen(function* () {
    yield* ensureOperation(trx, input.operationId, input.fence, now);
    const row = yield* loadObjectForFence(trx, input);
    if (row.state === "deleting" || row.state === "deleted") {
      return yield* new ObjectNotAdoptableError({
        key: input.key,
        message: "Deleting and deleted media objects cannot be adopted",
      });
    }
    if (row.state === "unknown") {
      return yield* new ObjectNotAdoptableError({
        key: input.key,
        message: "Unknown media objects require verified reconciliation",
      });
    }
    if (row.state === "preparing") {
      return {
        object: toObjectSnapshot(row),
        outcome: "already-preparing",
      } as const;
    }
    if (row.state === "ready") {
      return {
        object: toObjectSnapshot(row),
        outcome: "already-ready",
      } as const;
    }
    const updated = yield* trx.executeTakeFirstOrError(
      trx
        .updateTable("media_objects")
        .set({ state: "preparing", updatedAt: now })
        .where("key", "=", input.key)
        .where("operationId", "=", input.operationId)
        .where("fence", "=", input.fence)
        .returningAll(),
    );
    return {
      object: toObjectSnapshot(updated),
      outcome: "changed",
    } as const;
  });

const markReadyInTransaction = (
  trx: LifecycleTransaction,
  input: MarkReadyInput,
  now: Date,
): Effect.Effect<ObjectTransitionResult, LifecycleError> =>
  Effect.gen(function* () {
    yield* ensureOperation(trx, input.operationId, input.fence, now);
    const row = yield* loadObjectForFence(trx, input);
    yield* checkObservedObject(row, input.observed);
    if (row.state === "deleting" || row.state === "deleted") {
      return yield* new ObjectNotAdoptableError({
        key: input.key,
        message: "Deleting and deleted media objects cannot be adopted",
      });
    }
    if (row.state === "unknown") {
      return yield* new ObjectNotAdoptableError({
        key: input.key,
        message: "Unknown media objects require the adoptObject path",
      });
    }
    if (row.state === "ready") {
      return {
        object: toObjectSnapshot(row),
        outcome: "already-ready",
      } as const;
    }
    if (row.state !== "preparing") {
      return yield* new LifecycleStateError({
        message: "Media object must be preparing before it becomes ready",
        resourceId: input.key,
      });
    }
    const updated = yield* trx.executeTakeFirstOrError(
      trx
        .updateTable("media_objects")
        .set({ state: "ready", updatedAt: now })
        .where("key", "=", input.key)
        .where("operationId", "=", input.operationId)
        .where("fence", "=", input.fence)
        .returningAll(),
    );
    return {
      object: toObjectSnapshot(updated),
      outcome: "changed",
    } as const;
  });

const adoptInTransaction = (
  trx: LifecycleTransaction,
  input: AdoptObjectInput,
  now: Date,
): Effect.Effect<ObjectTransitionResult, LifecycleError> =>
  Effect.gen(function* () {
    yield* ensureOperation(trx, input.operationId, input.fence, now);
    const row = yield* loadObjectForFence(trx, input);
    yield* checkObservedObject(row, input.observed);
    if (row.state === "deleting" || row.state === "deleted") {
      return yield* new ObjectNotAdoptableError({
        key: input.key,
        message: "Deleting and deleted media objects cannot be adopted",
      });
    }
    if (row.state === "ready") {
      return {
        object: toObjectSnapshot(row),
        outcome: "already-ready",
      } as const;
    }
    const updated = yield* trx.executeTakeFirstOrError(
      trx
        .updateTable("media_objects")
        .set({ state: "ready", updatedAt: now })
        .where("key", "=", input.key)
        .where("operationId", "=", input.operationId)
        .where("fence", "=", input.fence)
        .where("state", "in", ["reserved", "preparing", "unknown"])
        .returningAll(),
    );
    return {
      object: toObjectSnapshot(updated),
      outcome: "changed",
    } as const;
  });

const finishInTransaction = (
  trx: LifecycleTransaction,
  input: FinishOperationInput,
  now: Date,
): Effect.Effect<FinishOperationResult, LifecycleError> =>
  Effect.gen(function* () {
    const option = yield* trx.executeTakeFirstOption(
      trx
        .selectFrom("media_operations")
        .selectAll()
        .where("id", "=", input.operationId)
        .forUpdate(),
    );
    if (Option.isNone(option)) {
      return yield* new OperationFenceError({
        message: "Lifecycle operation was not found",
        operationId: input.operationId,
      });
    }
    const current = toOperationSnapshot(option.value);
    if (isTerminalStatus(current.status)) {
      return {
        operation: current,
        outcome: "replayed",
        result: current.result,
      } as const;
    }
    if (current.fence !== input.fence) {
      return yield* new OperationFenceError({
        message: "Lifecycle operation fence is no longer current",
        operationId: input.operationId,
      });
    }

    const objects = yield* trx.execute(
      trx
        .selectFrom("media_objects")
        .select(["key", "state"])
        .where("operationId", "=", input.operationId),
    );
    // A restore reuses an already-ready managed object owned by its original
    // operation, so it has no new media_objects row to reserve. All operations
    // that create or replace bytes still require their reserved objects to be
    // ready before completion.
    if (
      (objects.length === 0 &&
        current.kind !== "video-restore" &&
        current.kind !== "post-update" &&
        current.kind !== "edit-apply") ||
      objects.some((object) => object.state !== "ready")
    ) {
      return yield* new OperationNotReadyError({
        message: "Every reserved media object must be ready before completion",
        operationId: input.operationId,
      });
    }

    const completed = yield* trx.executeTakeFirstOrError(
      trx
        .updateTable("media_operations")
        .set({
          completedAt: now,
          failureCode: null,
          result: input.result,
          status: "completed",
          updatedAt: now,
        })
        .where("id", "=", input.operationId)
        .where("fence", "=", input.fence)
        .where("status", "in", ["in-progress", "unknown"])
        .returningAll(),
    );
    const operation = toOperationSnapshot(completed);
    return {
      operation,
      outcome: "completed",
      result: operation.result,
    } as const;
  });

const failInTransaction = (
  trx: LifecycleTransaction,
  input: FailOperationInput,
  now: Date,
): Effect.Effect<FailOperationResult, LifecycleError> =>
  Effect.gen(function* () {
    const option = yield* trx.executeTakeFirstOption(
      trx
        .selectFrom("media_operations")
        .selectAll()
        .where("id", "=", input.operationId)
        .forUpdate(),
    );
    if (Option.isNone(option)) {
      return yield* new OperationFenceError({
        message: "Lifecycle operation was not found",
        operationId: input.operationId,
      });
    }
    const current = toOperationSnapshot(option.value);
    if (isTerminalStatus(current.status)) {
      return {
        operation: current,
        outcome: "replayed",
        result: current.result,
      } as const;
    }
    if (current.fence !== input.fence) {
      return yield* new OperationFenceError({
        message: "Lifecycle operation fence is no longer current",
        operationId: input.operationId,
      });
    }
    const terminal = input.status !== "unknown";
    const updated = yield* trx.executeTakeFirstOrError(
      trx
        .updateTable("media_operations")
        .set({
          completedAt: terminal ? now : null,
          failureCode: input.failureCode,
          result: input.result ?? null,
          status: input.status,
          updatedAt: now,
        })
        .where("id", "=", input.operationId)
        .where("fence", "=", input.fence)
        .where("status", "in", ["in-progress", "unknown"])
        .returningAll(),
    );
    const operation = toOperationSnapshot(updated);
    return {
      operation,
      outcome: terminal ? "failed" : "marked-unknown",
      result: operation.result,
    } as const;
  });

const beginDeleteInTransaction = (
  trx: LifecycleTransaction,
  input: BeginDeleteInput,
  now: Date,
): Effect.Effect<BeginDeleteResult, LifecycleError> =>
  Effect.gen(function* () {
    const option = yield* trx.executeTakeFirstOption(
      trx
        .selectFrom("media_objects")
        .selectAll()
        .where("key", "=", input.key)
        .forUpdate(),
    );
    if (Option.isNone(option)) {
      return yield* new ObjectNotFoundError({
        key: input.key,
        message: "Managed media object was not found",
      });
    }
    const row = option.value;
    if (row.state === "deleted") {
      return yield* new ObjectNotAdoptableError({
        key: input.key,
        message: "Deleted media object is a permanent tombstone",
      });
    }
    if (row.state === "deleting") {
      if (row.operationId !== input.operationId) {
        return yield* new OperationFenceError({
          message: "Managed media object fence is no longer current",
          operationId: input.operationId,
        });
      }
      return {
        fence: row.fence,
        key: row.key,
        outcome: "already-deleting",
      } as const;
    }
    if (row.operationId !== input.operationId || row.fence !== input.fence) {
      return yield* new OperationFenceError({
        message: "Managed media object fence is no longer current",
        operationId: input.operationId,
      });
    }
    if (row.state !== "ready") {
      return yield* new LifecycleStateError({
        message: "Only ready media objects can be deleted",
        resourceId: input.key,
      });
    }

    const postRef = yield* trx.executeTakeFirstOption(
      trx
        .selectFrom("posts")
        .select("id")
        .where((eb) =>
          eb.or([
            eb("videoKey", "=", input.key),
            eb("thumbnailKey", "=", input.key),
          ]),
        )
        .limit(1),
    );
    const imageRef = yield* trx.executeTakeFirstOption(
      trx
        .selectFrom("post_images")
        .select("postId")
        .where("storageKey", "=", input.key)
        .limit(1),
    );
    const revisionRef = yield* trx.executeTakeFirstOption(
      trx
        .selectFrom("video_revisions")
        .select("id")
        .where("videoKey", "=", input.key)
        .limit(1),
    );
    if (
      Option.isSome(postRef) ||
      Option.isSome(imageRef) ||
      Option.isSome(revisionRef)
    ) {
      return {
        fence: row.fence,
        key: row.key,
        outcome: "protected",
      } as const;
    }

    const updated = yield* trx.executeTakeFirstOrError(
      trx
        .updateTable("media_objects")
        .set({
          deletingCommittedAt: now,
          fence: sql<number>`"fence" + 1`,
          state: "deleting",
          updatedAt: now,
        })
        .where("key", "=", input.key)
        .where("operationId", "=", input.operationId)
        .where("fence", "=", input.fence)
        .where("state", "=", "ready")
        .returning(["fence", "key"]),
    );
    return {
      fence: updated.fence,
      key: updated.key,
      outcome: "deleting",
    } as const;
  });

const completeDeleteInTransaction = (
  trx: LifecycleTransaction,
  input: ObjectFenceInput,
  now: Date,
): Effect.Effect<CompleteDeleteResult, LifecycleError> =>
  Effect.gen(function* () {
    const option = yield* trx.executeTakeFirstOption(
      trx
        .selectFrom("media_objects")
        .selectAll()
        .where("key", "=", input.key)
        .forUpdate(),
    );
    if (Option.isNone(option)) {
      return yield* new ObjectNotFoundError({
        key: input.key,
        message: "Managed media object was not found",
      });
    }
    const row = option.value;
    if (row.state === "deleted" && row.operationId === input.operationId) {
      return { key: input.key, outcome: "already-deleted" } as const;
    }
    if (row.operationId !== input.operationId || row.fence !== input.fence) {
      return yield* new OperationFenceError({
        message: "Managed media object fence is no longer current",
        operationId: input.operationId,
      });
    }
    if (row.state !== "deleting") {
      return yield* new LifecycleStateError({
        message: "Only a committed deleting object can become deleted",
        resourceId: input.key,
      });
    }
    yield* trx.execute(
      trx
        .updateTable("media_objects")
        .set({ state: "deleted", updatedAt: now })
        .where("key", "=", input.key)
        .where("operationId", "=", input.operationId)
        .where("fence", "=", input.fence)
        .where("state", "=", "deleting"),
    );
    return { key: input.key, outcome: "deleted" } as const;
  });

const quarantineInTransaction = (
  trx: LifecycleTransaction,
  input: ObjectFenceInput,
  now: Date,
): Effect.Effect<void, LifecycleError> =>
  Effect.gen(function* () {
    yield* trx.execute(
      trx
        .updateTable("media_objects")
        .set({ state: "unknown", updatedAt: now })
        .where("key", "=", input.key)
        .where("operationId", "=", input.operationId)
        .where("fence", "=", input.fence)
        .where("state", "in", ["reserved", "preparing"]),
    );
  });

const postVersionUpdateInTransaction = (
  trx: LifecycleTransaction,
  input: UpdatePostWithVersionInput,
): Effect.Effect<PostVersionResult, LifecycleError> =>
  Effect.gen(function* () {
    const updated = yield* trx.executeTakeFirstOption(
      trx
        .updateTable("posts")
        .set({
          ...input.changes,
          version: sql<number>`"version" + 1`,
        })
        .where("id", "=", input.postId)
        .$if(input.ownerUserId !== undefined, (query) =>
          // SAFETY: Kysely's $if callback does not preserve the preceding undefined guard in its generic query type.
          query.where("userId", "=", input.ownerUserId as string),
        )
        .where("version", "=", input.expectedVersion)
        .returning(["id", "version"]),
    );
    if (Option.isSome(updated)) {
      return { postId: updated.value.id, version: updated.value.version };
    }
    const current = yield* trx.executeTakeFirstOption(
      trx
        .selectFrom("posts")
        .select(["id", "version"])
        .where("id", "=", input.postId),
    );
    if (Option.isNone(current)) {
      return yield* new PostNotFoundForVersionError({
        message: `Post ${input.postId} was not found`,
        postId: input.postId,
      });
    }
    return yield* new PostVersionConflictError({
      actualVersion: current.value.version,
      expectedVersion: input.expectedVersion,
      message: `Post ${input.postId} changed while it was being edited`,
      postId: input.postId,
    });
  });

const compareAndIncrementPostVersionInTransaction = (
  trx: LifecycleTransaction,
  input: CompareAndIncrementPostVersionInput,
): Effect.Effect<PostVersionResult, LifecycleError> =>
  postVersionUpdateInTransaction(trx, { ...input, changes: {} });

export class LifecycleService extends Context.Service<
  LifecycleService,
  {
    readonly adoptObject: (
      input: AdoptObjectInput,
    ) => Effect.Effect<ObjectTransitionResult, LifecycleError>;
    readonly beginDelete: (
      input: BeginDeleteInput,
    ) => Effect.Effect<BeginDeleteResult, LifecycleError>;
    readonly claimOperation: (
      input: ClaimOperationInput,
    ) => Effect.Effect<ClaimOperationResult, LifecycleError>;
    readonly compareAndIncrementPostVersion: (
      input: CompareAndIncrementPostVersionInput,
    ) => Effect.Effect<PostVersionResult, LifecycleError>;
    readonly completeDelete: (
      input: ObjectFenceInput,
    ) => Effect.Effect<CompleteDeleteResult, LifecycleError>;
    readonly failOperation: (
      input: FailOperationInput,
    ) => Effect.Effect<FailOperationResult, LifecycleError>;
    readonly finishOperation: (
      input: FinishOperationInput,
    ) => Effect.Effect<FinishOperationResult, LifecycleError>;
    readonly markPreparing: (
      input: ObjectFenceInput,
    ) => Effect.Effect<ObjectTransitionResult, LifecycleError>;
    readonly markReady: (
      input: MarkReadyInput,
    ) => Effect.Effect<ObjectTransitionResult, LifecycleError>;
    readonly reconcileNonTerminal: (
      input?: ReconcileInput,
    ) => Effect.Effect<ReconcileResult, LifecycleError>;
    readonly reserveObject: (
      input: ReserveObjectInput,
    ) => Effect.Effect<ReserveObjectResult, LifecycleError>;
    readonly updatePostWithVersion: (
      input: UpdatePostWithVersionInput,
    ) => Effect.Effect<PostVersionResult, LifecycleError>;
  }
>()("LifecycleService", {
  make: Effect.gen(function* () {
    const db = yield* KyselyDB;
    const storage = yield* StorageModule;

    const claimOperation = Effect.fn("LifecycleService.claimOperation")(
      function* (input: ClaimOperationInput) {
        yield* validateClaimInput(input);
        const now = new Date(yield* Clock.currentTimeMillis);
        return yield* db
          .transaction()
          .execute((trx) => claimInTransaction(trx, input, now));
      },
    );

    const reserveObject = Effect.fn("LifecycleService.reserveObject")(
      function* (input: ReserveObjectInput) {
        const now = new Date(yield* Clock.currentTimeMillis);
        return yield* db
          .transaction()
          .execute((trx) => reserveInTransaction(trx, input, now));
      },
    );

    const markPreparing = Effect.fn("LifecycleService.markPreparing")(
      function* (input: ObjectFenceInput) {
        const now = new Date(yield* Clock.currentTimeMillis);
        return yield* db
          .transaction()
          .execute((trx) => markPreparingInTransaction(trx, input, now));
      },
    );

    const markReady = Effect.fn("LifecycleService.markReady")(function* (
      input: MarkReadyInput,
    ) {
      const now = new Date(yield* Clock.currentTimeMillis);
      return yield* db
        .transaction()
        .execute((trx) => markReadyInTransaction(trx, input, now));
    });

    const adoptObject = Effect.fn("LifecycleService.adoptObject")(function* (
      input: AdoptObjectInput,
    ) {
      const now = new Date(yield* Clock.currentTimeMillis);
      return yield* db
        .transaction()
        .execute((trx) => adoptInTransaction(trx, input, now));
    });

    const finishOperation = Effect.fn("LifecycleService.finishOperation")(
      function* (input: FinishOperationInput) {
        yield* validateOperationResult(input.result);
        const now = new Date(yield* Clock.currentTimeMillis);
        return yield* db
          .transaction()
          .execute((trx) => finishInTransaction(trx, input, now));
      },
    );

    const failOperation = Effect.fn("LifecycleService.failOperation")(
      function* (input: FailOperationInput) {
        yield* validateFailureInput(input);
        yield* validateOperationResult(input.result);
        const now = new Date(yield* Clock.currentTimeMillis);
        return yield* db
          .transaction()
          .execute((trx) => failInTransaction(trx, input, now));
      },
    );

    const beginDelete = Effect.fn("LifecycleService.beginDelete")(function* (
      input: BeginDeleteInput,
    ) {
      const now = new Date(yield* Clock.currentTimeMillis);
      return yield* db
        .transaction()
        .execute((trx) => beginDeleteInTransaction(trx, input, now));
    });

    const completeDelete = Effect.fn("LifecycleService.completeDelete")(
      function* (input: ObjectFenceInput) {
        const now = new Date(yield* Clock.currentTimeMillis);
        return yield* db
          .transaction()
          .execute((trx) => completeDeleteInTransaction(trx, input, now));
      },
    );

    const updatePostWithVersion = Effect.fn(
      "LifecycleService.updatePostWithVersion",
    )(function* (input: UpdatePostWithVersionInput) {
      return yield* db
        .transaction()
        .execute((trx) => postVersionUpdateInTransaction(trx, input));
    });

    const compareAndIncrementPostVersion = Effect.fn(
      "LifecycleService.compareAndIncrementPostVersion",
    )(function* (input: CompareAndIncrementPostVersionInput) {
      return yield* db
        .transaction()
        .execute((trx) =>
          compareAndIncrementPostVersionInTransaction(trx, input),
        );
    });

    const reconcileNonTerminal = Effect.fn(
      "LifecycleService.reconcileNonTerminal",
    )(function* (input: ReconcileInput = {}) {
      const now = new Date(yield* Clock.currentTimeMillis);
      const objects = yield* db.execute(
        db
          .selectFrom("media_objects")
          .selectAll()
          .where("state", "in", [
            "reserved",
            "preparing",
            "unknown",
            "deleting",
          ])
          .$if(input.operationId !== undefined, (query) =>
            // SAFETY: Kysely's $if callback does not preserve the preceding undefined guard in its generic query type.
            query.where("operationId", "=", input.operationId as string),
          )
          .orderBy("createdAt", "asc"),
      );
      const adoptedKeys: string[] = [];
      const completedDeleteKeys: string[] = [];
      const quarantinedKeys: string[] = [];

      for (const row of objects) {
        const fenceInput = {
          fence: row.fence,
          key: row.key,
          operationId: row.operationId,
        } satisfies ObjectFenceInput;
        if (row.state === "deleting") {
          // DELETE is deliberately outside every DB transaction. S3 DELETE is
          // safe to repeat after a lost response, so reconcile can confirm the
          // tombstone without guessing whether the first request committed.
          const deletion = yield* storage.deleteFile(row.key).pipe(Effect.exit);
          if (Exit.isSuccess(deletion)) {
            const completed = yield* completeDelete(fenceInput);
            if (completed.outcome === "deleted")
              completedDeleteKeys.push(row.key);
          } else {
            quarantinedKeys.push(row.key);
          }
          continue;
        }

        const head = yield* storage.headFile(row.key).pipe(Effect.exit);
        if (Exit.isFailure(head)) {
          quarantinedKeys.push(row.key);
          yield* db
            .transaction()
            .execute((trx) => quarantineInTransaction(trx, fenceInput, now));
          continue;
        }
        const metadataFingerprint = head.value.metadataFingerprint;
        const observedFingerprint =
          metadataFingerprint ??
          (head.value.etag === null ? "" : `etag:${head.value.etag}`);
        if (observedFingerprint.length === 0) {
          quarantinedKeys.push(row.key);
          yield* db
            .transaction()
            .execute((trx) => quarantineInTransaction(trx, fenceInput, now));
          continue;
        }
        const adopted = yield* adoptObject({
          ...fenceInput,
          observed: {
            contentLength: head.value.contentLength,
            contentType: head.value.contentType,
            fingerprint: observedFingerprint,
          },
        }).pipe(Effect.exit);
        if (Exit.isSuccess(adopted)) {
          adoptedKeys.push(row.key);
        } else {
          quarantinedKeys.push(row.key);
          yield* db
            .transaction()
            .execute((trx) => quarantineInTransaction(trx, fenceInput, now));
        }
      }

      const pendingRows = yield* db.execute(
        db
          .selectFrom("media_operations")
          .select(["id"])
          .where("status", "in", ["in-progress", "unknown"])
          .$if(input.operationId !== undefined, (query) =>
            // SAFETY: Kysely's $if callback does not preserve the preceding undefined guard in its generic query type.
            query.where("id", "=", input.operationId as string),
          ),
      );
      return {
        adoptedKeys,
        completedDeleteKeys,
        inspected: objects.length,
        pendingOperationIds: pendingRows.map((row) => row.id),
        quarantinedKeys,
      } satisfies ReconcileResult;
    });

    return {
      adoptObject,
      beginDelete,
      claimOperation,
      compareAndIncrementPostVersion,
      completeDelete,
      failOperation,
      finishOperation,
      markPreparing,
      markReady,
      reconcileNonTerminal,
      reserveObject,
      updatePostWithVersion,
    };
  }),
}) {
  static readonly adoptObject = Effect.fn("LifecycleService.adoptObject")(
    function* (input: AdoptObjectInput) {
      const lifecycle = yield* LifecycleService;
      return yield* lifecycle.adoptObject(input);
    },
  );

  static readonly beginDelete = Effect.fn("LifecycleService.beginDelete")(
    function* (input: BeginDeleteInput) {
      const lifecycle = yield* LifecycleService;
      return yield* lifecycle.beginDelete(input);
    },
  );

  static readonly claimOperation = Effect.fn("LifecycleService.claimOperation")(
    function* (input: ClaimOperationInput) {
      const lifecycle = yield* LifecycleService;
      return yield* lifecycle.claimOperation(input);
    },
  );

  static readonly completeDelete = Effect.fn("LifecycleService.completeDelete")(
    function* (input: ObjectFenceInput) {
      const lifecycle = yield* LifecycleService;
      return yield* lifecycle.completeDelete(input);
    },
  );

  static readonly compareAndIncrementPostVersion = Effect.fn(
    "LifecycleService.compareAndIncrementPostVersion",
  )(function* (input: CompareAndIncrementPostVersionInput) {
    const lifecycle = yield* LifecycleService;
    return yield* lifecycle.compareAndIncrementPostVersion(input);
  });

  static readonly failOperation = Effect.fn("LifecycleService.failOperation")(
    function* (input: FailOperationInput) {
      const lifecycle = yield* LifecycleService;
      return yield* lifecycle.failOperation(input);
    },
  );

  static readonly finishOperation = Effect.fn(
    "LifecycleService.finishOperation",
  )(function* (input: FinishOperationInput) {
    const lifecycle = yield* LifecycleService;
    return yield* lifecycle.finishOperation(input);
  });

  static readonly markPreparing = Effect.fn("LifecycleService.markPreparing")(
    function* (input: ObjectFenceInput) {
      const lifecycle = yield* LifecycleService;
      return yield* lifecycle.markPreparing(input);
    },
  );

  static readonly markReady = Effect.fn("LifecycleService.markReady")(
    function* (input: MarkReadyInput) {
      const lifecycle = yield* LifecycleService;
      return yield* lifecycle.markReady(input);
    },
  );

  static readonly reconcileNonTerminal = Effect.fn(
    "LifecycleService.reconcileNonTerminal",
  )(function* (input?: ReconcileInput) {
    const lifecycle = yield* LifecycleService;
    return yield* lifecycle.reconcileNonTerminal(input);
  });

  static readonly reserveObject = Effect.fn("LifecycleService.reserveObject")(
    function* (input: ReserveObjectInput) {
      const lifecycle = yield* LifecycleService;
      return yield* lifecycle.reserveObject(input);
    },
  );

  static readonly updatePostWithVersion = Effect.fn(
    "LifecycleService.updatePostWithVersion",
  )(function* (input: UpdatePostWithVersionInput) {
    const lifecycle = yield* LifecycleService;
    return yield* lifecycle.updatePostWithVersion(input);
  });
}

export const LifecycleServiceLive = Layer.effect(
  LifecycleService,
  LifecycleService.make,
);

/**
 * Integration helpers: use these inside the caller's one short transaction,
 * before/after inserting post references. No storage call belongs in that
 * transaction.
 */
export {
  adoptInTransaction as adoptObjectInTransaction,
  beginDeleteInTransaction,
  compareAndIncrementPostVersionInTransaction,
  completeDeleteInTransaction,
  failInTransaction as failOperationInTransaction,
  finishInTransaction as finishOperationInTransaction,
  markPreparingInTransaction,
  markReadyInTransaction,
  postVersionUpdateInTransaction as updatePostWithVersionInTransaction,
};

export type { DeterministicMediaKind };
