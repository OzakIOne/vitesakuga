import { Effect, Layer } from "effect";
import { TestClock } from "effect/testing";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { KyselyDB } from "../db/context";
import { makeServiceTestLayer } from "../db/test-utils";
import { imageObjectKey, videoObjectKey } from "../storage/keys";
import { StorageModule } from "../storage/storage.module";
import {
  LifecycleService,
  LifecycleServiceLive,
  OperationConflictError,
  OperationFenceError,
  ObjectConflictError,
  PostVersionConflictError,
  finishOperationInTransaction,
  markPreparingInTransaction,
  markReadyInTransaction,
  type ClaimOperationInput,
} from "./lifecycle.service";

const fingerprint = "sha256:" + "a".repeat(64);
const secondFingerprint = "sha256:" + "b".repeat(64);

const claimInput: ClaimOperationInput = {
  kind: "post-create",
  operationKey: "post-operation-1",
  requestFingerprint: fingerprint,
  userId: "lifecycle-user",
};

let context: Awaited<
  ReturnType<typeof makeServiceTestLayer<LifecycleService, never>>
>;

beforeEach(async () => {
  context = await makeServiceTestLayer(LifecycleServiceLive);
  await context.db
    .insertInto("user")
    .values({
      email: "lifecycle@test.invalid",
      id: claimInput.userId,
      name: "Lifecycle Test",
      username: "lifecycle_test",
    })
    .execute();
  await context.db
    .insertInto("user")
    .values({
      email: "other.lifecycle@test.invalid",
      id: "other-lifecycle-user",
      name: "Other Lifecycle Test",
      username: "other_lifecycle_test",
    })
    .execute();
});

afterEach(async () => {
  await context.close();
});

describe("LifecycleService operation claims", () => {
  it("keeps one durable owner fence for competing claims", async () => {
    const [first, second] = await Promise.all([
      context.runEffect(
        Effect.gen(function* () {
          const lifecycle = yield* LifecycleService;
          return yield* lifecycle.claimOperation(claimInput);
        }),
      ),
      context.runEffect(
        Effect.gen(function* () {
          const lifecycle = yield* LifecycleService;
          return yield* lifecycle.claimOperation(claimInput);
        }),
      ),
    ]);

    expect(first.outcome).toBe("claimed");
    expect(second.outcome).toBe("claimed");
    if (first.outcome !== "claimed" || second.outcome !== "claimed") {
      throw new Error("claim was replayed");
    }
    expect(second.fence).toBeGreaterThan(first.fence);

    const row = await context.db
      .selectFrom("media_operations")
      .select(["id", "fence", "status"])
      .where("userId", "=", claimInput.userId)
      .where("operationKey", "=", claimInput.operationKey)
      .executeTakeFirstOrThrow();

    expect(row.id).toBe(first.operationId);
    expect(row.fence).toBe(second.fence);
    expect(row.status).toBe("in-progress");
  });

  it("retries a lost response after markReady by reusing the ready object", async () => {
    const first = await context.runEffect(
      Effect.gen(function* () {
        const lifecycle = yield* LifecycleService;
        return yield* lifecycle.claimOperation({
          ...claimInput,
          operationKey: "lost-mark-ready-response",
        });
      }),
    );
    if (first.outcome !== "claimed") throw new Error("claim was replayed");
    const object = {
      contentLength: 12,
      contentType: "video/mp4",
      fence: first.fence,
      fingerprint: 'etag:"ready-retry"',
      key: videoObjectKey(first.operationId, "mp4"),
      kind: "video" as const,
      operationId: first.operationId,
      userId: claimInput.userId,
    };
    await context.runEffect(
      Effect.gen(function* () {
        const lifecycle = yield* LifecycleService;
        yield* lifecycle.reserveObject(object);
        yield* lifecycle.markPreparing(object);
        yield* lifecycle.markReady(object);
      }),
    );

    const retry = await context.runEffect(
      Effect.gen(function* () {
        const lifecycle = yield* LifecycleService;
        return yield* lifecycle.claimOperation({
          ...claimInput,
          operationKey: "lost-mark-ready-response",
        });
      }),
    );
    if (retry.outcome !== "claimed") throw new Error("operation was replayed");
    expect(retry.fence).toBe(first.fence + 1);

    const reused = await context.runEffect(
      Effect.gen(function* () {
        const lifecycle = yield* LifecycleService;
        return yield* lifecycle.reserveObject({
          ...object,
          fence: retry.fence,
        });
      }),
    );
    expect(reused.outcome).toBe("reused");
    expect(reused.object.state).toBe("ready");
    expect(reused.object.fence).toBe(retry.fence);

    const completed = await context.runEffect(
      Effect.gen(function* () {
        const lifecycle = yield* LifecycleService;
        return yield* lifecycle.finishOperation({
          fence: retry.fence,
          operationId: retry.operationId,
          result: { videoKey: object.key },
        });
      }),
    );
    expect(completed.outcome).toBe("completed");
  });

  it("uses the Effect clock for lifecycle timestamps", async () => {
    // PGlite's timestamp-without-time-zone columns round-trip through the
    // process timezone, so derive the persisted instant from that timezone.
    const fixedMillis = Date.parse("2025-01-02T04:04:05.678Z");
    const timezoneOffsetMillis =
      new Date(fixedMillis).getTimezoneOffset() * 60_000;
    const expectedMillis = fixedMillis + timezoneOffsetMillis;
    const claim = await Effect.runPromise(
      Effect.gen(function* () {
        yield* TestClock.setTime(fixedMillis);
        const lifecycle = yield* LifecycleService;
        return yield* lifecycle.claimOperation({
          ...claimInput,
          operationKey: "fixed-clock-operation",
        });
      }).pipe(
        Effect.provide(Layer.merge(TestClock.layer(), context.testLayer)),
      ),
    );
    expect(claim.operation.createdAt).toEqual(new Date(expectedMillis));
    expect(claim.operation.updatedAt).toEqual(new Date(expectedMillis));
  });

  it("reserves a deterministic object and reuses its row on retry", async () => {
    const claim = await context.runEffect(
      Effect.gen(function* () {
        const lifecycle = yield* LifecycleService;
        return yield* lifecycle.claimOperation(claimInput);
      }),
    );
    if (claim.outcome !== "claimed") throw new Error("claim was replayed");

    const reserveInput = {
      contentLength: 12,
      contentType: "video/mp4",
      fingerprint: 'etag:"source-etag"',
      fence: claim.fence,
      key: videoObjectKey(claim.operationId, "mp4"),
      kind: "video" as const,
      operationId: claim.operationId,
      userId: claimInput.userId,
    };
    const first = await context.runEffect(
      Effect.gen(function* () {
        const lifecycle = yield* LifecycleService;
        return yield* lifecycle.reserveObject(reserveInput);
      }),
    );
    const second = await context.runEffect(
      Effect.gen(function* () {
        const lifecycle = yield* LifecycleService;
        return yield* lifecycle.reserveObject(reserveInput);
      }),
    );

    expect(first.outcome).toBe("reserved");
    expect(second.outcome).toBe("reused");
    expect(second.object.key).toBe(reserveInput.key);

    const rows = await context.db
      .selectFrom("media_objects")
      .selectAll()
      .where("key", "=", reserveInput.key)
      .execute();
    expect(rows).toHaveLength(1);
    expect(rows[0]?.state).toBe("reserved");
  });

  it("rejects a changed request without changing the original row", async () => {
    await context.runEffect(
      Effect.gen(function* () {
        const lifecycle = yield* LifecycleService;
        return yield* lifecycle.claimOperation(claimInput);
      }),
    );

    const failure = await context.runFailure(
      Effect.gen(function* () {
        const lifecycle = yield* LifecycleService;
        return yield* lifecycle.claimOperation({
          ...claimInput,
          requestFingerprint: secondFingerprint,
        });
      }),
    );

    expect(failure).toBeInstanceOf(OperationConflictError);
    const row = await context.db
      .selectFrom("media_operations")
      .select(["requestFingerprint", "status", "fence"])
      .where("userId", "=", claimInput.userId)
      .where("operationKey", "=", claimInput.operationKey)
      .executeTakeFirstOrThrow();
    expect(row.requestFingerprint).toBe(fingerprint);
    expect(row.status).toBe("in-progress");
    expect(row.fence).toBe(1);
  });

  it("scopes an operation key to its owner", async () => {
    const first = await context.runEffect(
      Effect.gen(function* () {
        const lifecycle = yield* LifecycleService;
        return yield* lifecycle.claimOperation(claimInput);
      }),
    );
    const other = await context.runEffect(
      Effect.gen(function* () {
        const lifecycle = yield* LifecycleService;
        return yield* lifecycle.claimOperation({
          ...claimInput,
          userId: "other-lifecycle-user",
        });
      }),
    );
    if (first.outcome !== "claimed" || other.outcome !== "claimed") {
      throw new Error("claim was not created");
    }
    expect(other.operationId).not.toBe(first.operationId);
    expect(
      await context.db.selectFrom("media_operations").select("id").execute(),
    ).toHaveLength(2);
  });

  it("replays a completed operation before taking a new fence", async () => {
    const claim = await context.runEffect(
      Effect.gen(function* () {
        const lifecycle = yield* LifecycleService;
        return yield* lifecycle.claimOperation(claimInput);
      }),
    );
    if (claim.outcome !== "claimed") throw new Error("claim was replayed");

    const reserveInput = {
      contentLength: 12,
      contentType: "video/mp4",
      fingerprint: 'etag:"source-etag"',
      fence: claim.fence,
      key: videoObjectKey(claim.operationId, "mp4"),
      kind: "video" as const,
      operationId: claim.operationId,
      userId: claimInput.userId,
    };
    await context.runEffect(
      Effect.gen(function* () {
        const lifecycle = yield* LifecycleService;
        yield* lifecycle.reserveObject(reserveInput);
        yield* lifecycle.markPreparing(reserveInput);
        yield* lifecycle.markReady(reserveInput);
        return yield* lifecycle.finishOperation({
          fence: claim.fence,
          operationId: claim.operationId,
          result: { postId: 42, videoKey: reserveInput.key },
        });
      }),
    );

    const replay = await context.runEffect(
      Effect.gen(function* () {
        const lifecycle = yield* LifecycleService;
        return yield* lifecycle.claimOperation(claimInput);
      }),
    );
    expect(replay.outcome).toBe("replayed");
    if (replay.outcome !== "replayed")
      throw new Error("operation was reclaimed");
    expect(replay.result).toEqual({ postId: 42, videoKey: reserveInput.key });
    expect(replay.operation.fence).toBe(claim.fence);
  });

  it("persists a terminal conflict so its result is replayable", async () => {
    const claim = await context.runEffect(
      Effect.gen(function* () {
        const lifecycle = yield* LifecycleService;
        return yield* lifecycle.claimOperation({
          ...claimInput,
          operationKey: "conflict-operation",
        });
      }),
    );
    if (claim.outcome !== "claimed") throw new Error("claim was replayed");
    const failed = await context.runEffect(
      Effect.gen(function* () {
        const lifecycle = yield* LifecycleService;
        return yield* lifecycle.failOperation({
          failureCode: "post-version-conflict",
          fence: claim.fence,
          operationId: claim.operationId,
          result: { state: "conflict" },
          status: "conflict",
        });
      }),
    );
    expect(failed.outcome).toBe("failed");
    const replay = await context.runEffect(
      Effect.gen(function* () {
        const lifecycle = yield* LifecycleService;
        return yield* lifecycle.claimOperation({
          ...claimInput,
          operationKey: "conflict-operation",
        });
      }),
    );
    expect(replay.outcome).toBe("replayed");
    if (replay.outcome !== "replayed")
      throw new Error("conflict was reclaimed");
    expect(replay.operation.status).toBe("conflict");
    expect(replay.result).toEqual({ state: "conflict" });
  });

  it("fences the old worker after a retry claims the same request", async () => {
    const first = await context.runEffect(
      Effect.gen(function* () {
        const lifecycle = yield* LifecycleService;
        return yield* lifecycle.claimOperation(claimInput);
      }),
    );
    if (first.outcome !== "claimed") throw new Error("claim was replayed");
    const second = await context.runEffect(
      Effect.gen(function* () {
        const lifecycle = yield* LifecycleService;
        return yield* lifecycle.claimOperation(claimInput);
      }),
    );
    if (second.outcome !== "claimed") throw new Error("claim was replayed");

    const failure = await context.runFailure(
      Effect.gen(function* () {
        const lifecycle = yield* LifecycleService;
        return yield* lifecycle.reserveObject({
          contentLength: 1,
          contentType: "video/mp4",
          fence: first.fence,
          fingerprint: 'etag:"old"',
          key: videoObjectKey(first.operationId, "mp4"),
          kind: "video",
          operationId: first.operationId,
          userId: claimInput.userId,
        });
      }),
    );
    expect(failure).toBeInstanceOf(OperationFenceError);
  });

  it("exposes a short transaction contract for refs plus completion", async () => {
    const claim = await context.runEffect(
      Effect.gen(function* () {
        const lifecycle = yield* LifecycleService;
        return yield* lifecycle.claimOperation({
          ...claimInput,
          operationKey: "atomic-finalization-operation",
        });
      }),
    );
    if (claim.outcome !== "claimed") throw new Error("claim was replayed");
    const reserveInput = {
      contentLength: 12,
      contentType: "video/mp4",
      fence: claim.fence,
      fingerprint: 'etag:"atomic-video"',
      key: videoObjectKey(claim.operationId, "mp4"),
      kind: "video" as const,
      operationId: claim.operationId,
      userId: claimInput.userId,
    };
    await context.runEffect(
      Effect.gen(function* () {
        const lifecycle = yield* LifecycleService;
        return yield* lifecycle.reserveObject(reserveInput);
      }),
    );

    const finished = await context.runEffect(
      Effect.gen(function* () {
        const db = yield* KyselyDB;
        return yield* db.transaction().execute((trx) =>
          Effect.gen(function* () {
            yield* markPreparingInTransaction(trx, reserveInput, new Date());
            yield* markReadyInTransaction(trx, reserveInput, new Date());
            const post = yield* trx.executeTakeFirstOrError(
              trx
                .insertInto("posts")
                .values({
                  description: "atomic post",
                  thumbnailKey: "legacy-thumbnail",
                  title: "atomic post",
                  userId: claimInput.userId,
                  videoKey: reserveInput.key,
                  videoMetadata: "{}",
                })
                .returning("id"),
            );
            return yield* finishOperationInTransaction(
              trx,
              {
                fence: claim.fence,
                operationId: claim.operationId,
                result: { postId: post.id, videoKey: reserveInput.key },
              },
              new Date(),
            );
          }),
        );
      }),
    );
    expect(finished.outcome).toBe("completed");
    const rows = await context.db
      .selectFrom("media_operations")
      .innerJoin(
        "media_objects",
        "media_objects.operationId",
        "media_operations.id",
      )
      .innerJoin("posts", "posts.videoKey", "media_objects.key")
      .select([
        "media_operations.status",
        "media_objects.state",
        "posts.videoKey",
      ])
      .where("media_operations.id", "=", claim.operationId)
      .execute();
    expect(rows).toEqual([
      { state: "ready", status: "completed", videoKey: reserveInput.key },
    ]);
  });

  it("updates a post only when the client version still matches", async () => {
    const post = await context.db
      .insertInto("posts")
      .values({
        description: "before",
        thumbnailKey: "legacy-thumbnail",
        title: "before",
        userId: claimInput.userId,
        videoMetadata: "{}",
      })
      .returning(["id", "version"])
      .executeTakeFirstOrThrow();

    const updated = await context.runEffect(
      Effect.gen(function* () {
        const lifecycle = yield* LifecycleService;
        return yield* lifecycle.updatePostWithVersion({
          changes: { description: "after", title: "after" },
          expectedVersion: post.version,
          ownerUserId: claimInput.userId,
          postId: post.id,
        });
      }),
    );
    expect(updated.version).toBe(post.version + 1);

    const failure = await context.runFailure(
      Effect.gen(function* () {
        const lifecycle = yield* LifecycleService;
        return yield* lifecycle.updatePostWithVersion({
          changes: { title: "stale write" },
          expectedVersion: post.version,
          ownerUserId: claimInput.userId,
          postId: post.id,
        });
      }),
    );
    expect(failure).toBeInstanceOf(PostVersionConflictError);

    const row = await context.db
      .selectFrom("posts")
      .select(["title", "description", "version"])
      .where("id", "=", post.id)
      .executeTakeFirstOrThrow();
    expect(row).toEqual({
      description: "after",
      title: "after",
      version: post.version + 1,
    });
  });

  it("commits deleting before remote removal and preserves a tombstone", async () => {
    const claim = await context.runEffect(
      Effect.gen(function* () {
        const lifecycle = yield* LifecycleService;
        return yield* lifecycle.claimOperation({
          ...claimInput,
          operationKey: "delete-operation",
        });
      }),
    );
    if (claim.outcome !== "claimed") throw new Error("claim was replayed");
    const content = "image bytes";
    const key = imageObjectKey(claim.operationId, 0, "png");
    const stored = await context.runEffect(
      Effect.gen(function* () {
        const storage = yield* StorageModule;
        return yield* storage.putImage(
          key,
          new File([content], "image.png", { type: "image/png" }),
        );
      }),
    );
    const object = {
      contentLength: content.length,
      contentType: "image/png",
      fence: claim.fence,
      fingerprint: stored.fingerprint,
      key,
      kind: "image" as const,
      operationId: claim.operationId,
      userId: claimInput.userId,
    };
    await context.runEffect(
      Effect.gen(function* () {
        const lifecycle = yield* LifecycleService;
        yield* lifecycle.reserveObject(object);
        yield* lifecycle.markPreparing(object);
        yield* lifecycle.markReady({
          ...object,
          observed: {
            contentLength: object.contentLength,
            contentType: object.contentType,
            fingerprint: object.fingerprint,
          },
        });
      }),
    );

    const protectedPost = await context.db
      .insertInto("posts")
      .values({
        description: "protected reference",
        thumbnailKey: object.key,
        title: "protected reference",
        userId: claimInput.userId,
        videoMetadata: "{}",
      })
      .returning("id")
      .executeTakeFirstOrThrow();
    const protectedResult = await context.runEffect(
      Effect.gen(function* () {
        const lifecycle = yield* LifecycleService;
        return yield* lifecycle.beginDelete(object);
      }),
    );
    expect(protectedResult.outcome).toBe("protected");
    await context.db
      .deleteFrom("posts")
      .where("id", "=", protectedPost.id)
      .execute();

    const deleting = await context.runEffect(
      Effect.gen(function* () {
        const lifecycle = yield* LifecycleService;
        return yield* lifecycle.beginDelete(object);
      }),
    );
    expect(deleting.outcome).toBe("deleting");
    expect(deleting.fence).toBe(object.fence + 1);
    const deletingRow = await context.db
      .selectFrom("media_objects")
      .select(["state", "deletingCommittedAt", "fence"])
      .where("key", "=", object.key)
      .executeTakeFirstOrThrow();
    expect(deletingRow.state).toBe("deleting");
    expect(deletingRow.deletingCommittedAt).not.toBeNull();
    expect(deletingRow.fence).toBe(deleting.fence);

    const retryBegin = await context.runEffect(
      Effect.gen(function* () {
        const lifecycle = yield* LifecycleService;
        return yield* lifecycle.beginDelete(object);
      }),
    );
    expect(retryBegin).toEqual({
      fence: deleting.fence,
      key: object.key,
      outcome: "already-deleting",
    });

    const reconciled = await context.runEffect(
      Effect.gen(function* () {
        const lifecycle = yield* LifecycleService;
        return yield* lifecycle.reconcileNonTerminal({
          operationId: object.operationId,
        });
      }),
    );
    expect(reconciled.completedDeleteKeys).toEqual([object.key]);

    const deleted = await context.runEffect(
      Effect.gen(function* () {
        const lifecycle = yield* LifecycleService;
        return yield* lifecycle.completeDelete({
          fence: deleting.fence,
          key: object.key,
          operationId: object.operationId,
        });
      }),
    );
    expect(deleted.outcome).toBe("already-deleted");
    const retryDeleted = await context.runEffect(
      Effect.gen(function* () {
        const lifecycle = yield* LifecycleService;
        return yield* lifecycle.completeDelete({
          fence: deleting.fence,
          key: object.key,
          operationId: object.operationId,
        });
      }),
    );
    expect(retryDeleted.outcome).toBe("already-deleted");
    await context.runEffect(
      Effect.gen(function* () {
        const storage = yield* StorageModule;
        return yield* storage.putImage(
          object.key,
          new File([content], "image.png", { type: "image/png" }),
        );
      }),
    );
    const lateCopy = await context.runEffect(
      Effect.gen(function* () {
        const lifecycle = yield* LifecycleService;
        return yield* lifecycle.reconcileNonTerminal({
          operationId: object.operationId,
        });
      }),
    );
    expect(lateCopy.inspected).toBe(0);
    expect(lateCopy.adoptedKeys).toEqual([]);
    const row = await context.db
      .selectFrom("media_objects")
      .select("state")
      .where("key", "=", object.key)
      .executeTakeFirstOrThrow();
    expect(row.state).toBe("deleted");
  });

  it("reconciles a response-lost image upload by matching HEAD metadata", async () => {
    const claim = await context.runEffect(
      Effect.gen(function* () {
        const lifecycle = yield* LifecycleService;
        return yield* lifecycle.claimOperation({
          ...claimInput,
          operationKey: "reconcile-image-operation",
        });
      }),
    );
    if (claim.outcome !== "claimed") throw new Error("claim was replayed");
    const key = imageObjectKey(claim.operationId, 0, "png");
    const stored = await context.runEffect(
      Effect.gen(function* () {
        const storage = yield* StorageModule;
        return yield* storage.putImage(
          key,
          new File(["reconcile image"], "image.png", { type: "image/png" }),
        );
      }),
    );
    const reserved = await context.runEffect(
      Effect.gen(function* () {
        const lifecycle = yield* LifecycleService;
        return yield* lifecycle.reserveObject({
          contentLength: "reconcile image".length,
          contentType: "image/png",
          fence: claim.fence,
          fingerprint: stored.fingerprint,
          key,
          kind: "image",
          operationId: claim.operationId,
          userId: claimInput.userId,
        });
      }),
    );
    expect(reserved.outcome).toBe("reserved");

    const result = await context.runEffect(
      Effect.gen(function* () {
        const lifecycle = yield* LifecycleService;
        return yield* lifecycle.reconcileNonTerminal({
          operationId: claim.operationId,
        });
      }),
    );
    expect(result.adoptedKeys).toEqual([key]);
    expect(result.quarantinedKeys).toEqual([]);
    const row = await context.db
      .selectFrom("media_objects")
      .select(["state", "fingerprint"])
      .where("key", "=", key)
      .executeTakeFirstOrThrow();
    expect(row).toEqual({ fingerprint: stored.fingerprint, state: "ready" });
  });

  it("quarantines an unknown storage read, then adopts only after a later verified HEAD", async () => {
    const claim = await context.runEffect(
      Effect.gen(function* () {
        const lifecycle = yield* LifecycleService;
        return yield* lifecycle.claimOperation({
          ...claimInput,
          operationKey: "reconcile-quarantine-operation",
        });
      }),
    );
    if (claim.outcome !== "claimed") throw new Error("claim was replayed");
    const key = imageObjectKey(claim.operationId, 0, "png");
    const content = "verified image!";
    const stored = await context.runEffect(
      Effect.gen(function* () {
        const storage = yield* StorageModule;
        return yield* storage.putImage(
          key,
          new File([content], "image.png", { type: "image/png" }),
        );
      }),
    );
    await context.runEffect(
      Effect.gen(function* () {
        const storage = yield* StorageModule;
        return yield* storage.deleteFile(key);
      }),
    );
    const object = {
      contentLength: content.length,
      contentType: "image/png",
      fence: claim.fence,
      fingerprint: stored.fingerprint,
      key,
      kind: "image" as const,
      operationId: claim.operationId,
      userId: claimInput.userId,
    };
    await context.runEffect(
      Effect.gen(function* () {
        const lifecycle = yield* LifecycleService;
        return yield* lifecycle.reserveObject(object);
      }),
    );
    const first = await context.runEffect(
      Effect.gen(function* () {
        const lifecycle = yield* LifecycleService;
        return yield* lifecycle.reconcileNonTerminal({
          operationId: claim.operationId,
        });
      }),
    );
    expect(first.quarantinedKeys).toEqual([key]);
    expect(
      await context.db
        .selectFrom("media_objects")
        .select("state")
        .where("key", "=", key)
        .executeTakeFirstOrThrow(),
    ).toEqual({ state: "unknown" });

    const mismatch = await context.runFailure(
      Effect.gen(function* () {
        const lifecycle = yield* LifecycleService;
        return yield* lifecycle.adoptObject({
          fence: object.fence,
          key,
          operationId: object.operationId,
          observed: {
            contentLength: object.contentLength,
            contentType: object.contentType,
            fingerprint: secondFingerprint,
          },
        });
      }),
    );
    expect(mismatch).toBeInstanceOf(ObjectConflictError);

    const restored = await context.runEffect(
      Effect.gen(function* () {
        const storage = yield* StorageModule;
        return yield* storage.putImage(
          key,
          new File([content], "image.png", { type: "image/png" }),
        );
      }),
    );
    expect(restored.fingerprint).toBe(stored.fingerprint);
    const second = await context.runEffect(
      Effect.gen(function* () {
        const lifecycle = yield* LifecycleService;
        return yield* lifecycle.reconcileNonTerminal({
          operationId: claim.operationId,
        });
      }),
    );
    expect(second.adoptedKeys).toEqual([key]);
    expect(
      await context.db
        .selectFrom("media_objects")
        .select("state")
        .where("key", "=", key)
        .executeTakeFirstOrThrow(),
    ).toEqual({ state: "ready" });
  });
});
