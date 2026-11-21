import { Effect } from "effect";
import { afterEach, describe, expect, it } from "vitest";

import { makeServiceTestLayer } from "../db/test-utils";
import { imageObjectKey, thumbnailObjectKey } from "../storage/keys";
import { StorageModule } from "../storage/storage.module";
import {
  LifecycleService,
  LifecycleServiceLive,
  PostVersionConflictError,
  updatePostWithVersionInTransaction,
} from "./lifecycle.service";

const fingerprint = "sha256:" + "a".repeat(64);
const secondFingerprint = "sha256:" + "b".repeat(64);

let closeContext: (() => Promise<void>) | undefined;

afterEach(async () => {
  await closeContext?.();
  closeContext = undefined;
});

const openContext = async () => {
  const context = await makeServiceTestLayer(LifecycleServiceLive);
  closeContext = context.close;
  await context.db
    .insertInto("user")
    .values({
      email: "lifecycle@test.invalid",
      id: "user-1",
      name: "Lifecycle",
      username: "lifecycle_user",
    })
    .execute();
  return context;
};

const makeFile = (name: string, type: string, content = "test-bytes") =>
  new File([content], name, { type });

const digestFile = async (file: File) => {
  const bytes = await file.arrayBuffer();
  const hash = await crypto.subtle.digest("SHA-256", bytes);
  return `sha256:${Array.from(new Uint8Array(hash), (b) => b.toString(16).padStart(2, "0")).join("")}`;
};

describe("LifecycleService (narrowed Managed Media Protocol interface)", () => {
  it("commits image media atomically and replays on duplicate operationKey", async () => {
    const context = await openContext();
    let commitCalls = 0;
    const file = makeFile("a.png", "image/png");
    const fileFingerprint = await digestFile(file);

    const runUpload = () =>
      context.runEffect(
        Effect.gen(function* () {
          const lifecycle = yield* LifecycleService;
          return yield* lifecycle.runOperation({
            kind: "post-create",
            operationKey: "upload-1",
            replay: (result) => Effect.succeed(result.postId),
            request: { payload: { title: "First" } },
            userId: "user-1",
            run: (operation) =>
              lifecycle.commitPostMedia({
                images: [{ file, fingerprint: fileFingerprint }],
                operation,
                userId: "user-1",
                commit: (trx, media) =>
                  Effect.gen(function* () {
                    commitCalls += 1;
                    const row = yield* trx.executeTakeFirstOrError(
                      trx
                        .insertInto("posts")
                        .values({
                          description: "desc",
                          thumbnailKey: media.thumbnailKey,
                          title: "First",
                          userId: "user-1",
                          videoKey: media.videoKey,
                          videoMetadata: {},
                        })
                        .returningAll(),
                    );
                    yield* operation.finish(trx, {
                      imageKeys: [...media.imageKeys],
                      postId: row.id,
                      thumbnailKey: media.thumbnailKey,
                    });
                    return row.id;
                  }),
              }),
          });
        }),
      );

    const firstId = await runUpload();
    const replayedId = await runUpload();

    expect(replayedId).toBe(firstId);
    expect(commitCalls).toBe(1);

    const objects = await context.db
      .selectFrom("media_objects")
      .select(["key", "state"])
      .execute();
    expect(objects).toHaveLength(1);
    expect(objects[0]?.state).toBe("ready");
  });

  it("rolls back uploaded media when the post commit transaction fails", async () => {
    const context = await openContext();
    const file = makeFile("a.png", "image/png");
    const fileFingerprint = await digestFile(file);

    const failure = await context.runFailure(
      Effect.gen(function* () {
        const lifecycle = yield* LifecycleService;
        return yield* lifecycle.runOperation({
          kind: "post-create",
          operationKey: "upload-fail",
          replay: () => Effect.succeed("replayed"),
          request: { payload: { title: "Broken" } },
          userId: "user-1",
          run: (operation) =>
            lifecycle.commitPostMedia({
              images: [{ file, fingerprint: fileFingerprint }],
              operation,
              userId: "user-1",
              commit: () => Effect.fail("db-boom" as const),
            }),
        });
      }),
    );

    expect(failure).toBe("db-boom");

    const objects = await context.db
      .selectFrom("media_objects")
      .select(["key", "state"])
      .execute();
    expect(objects).toHaveLength(1);
    expect(objects[0]?.state).toBe("deleted");
  });

  it("protects live-referenced keys in deleteManagedKeys and deletes unreferenced ones", async () => {
    const context = await openContext();
    const thumbFile = makeFile("thumb.jpg", "image/jpeg");
    const thumbFingerprint = await digestFile(thumbFile);

    const { liveKey, orphanKey } = await context.runEffect(
      Effect.gen(function* () {
        const lifecycle = yield* LifecycleService;
        const live = yield* lifecycle.runOperation({
          kind: "post-create",
          operationKey: "op-live",
          replay: (result) => Effect.succeed(result.thumbnailKey),
          request: { payload: { kind: "live" } },
          userId: "user-1",
          run: (operation) =>
            lifecycle.commitPostMedia({
              operation,
              thumbnail: {
                file: thumbFile,
                fingerprint: thumbFingerprint,
              },
              userId: "user-1",
              commit: (trx, media) =>
                Effect.gen(function* () {
                  const post = yield* trx.executeTakeFirstOrError(
                    trx
                      .insertInto("posts")
                      .values({
                        description: "live",
                        thumbnailKey: media.thumbnailKey,
                        title: "Live",
                        userId: "user-1",
                        videoKey: null,
                        videoMetadata: {},
                      })
                      .returningAll(),
                  );
                  yield* operation.finish(trx, {
                    imageKeys: [],
                    postId: post.id,
                    thumbnailKey: media.thumbnailKey,
                  });
                  return media.thumbnailKey;
                }),
            }),
        });

        // Create an orphan ready object by inserting a media_operation + ready media_object
        const orphanOpId = "op-orphan-id";
        const orphan = thumbnailObjectKey(orphanOpId);
        const storage = yield* StorageModule;
        const stored = yield* storage.putThumbnail(
          orphan,
          makeFile("orphan.jpg", "image/jpeg", "orphan-bytes"),
        );
        yield* Effect.promise(() =>
          context.db
            .insertInto("media_operations")
            .values({
              fence: 1,
              id: orphanOpId,
              kind: "post-create",
              operationKey: "orphan-op",
              requestFingerprint: secondFingerprint,
              status: "completed",
              userId: "user-1",
            })
            .execute(),
        );
        yield* Effect.promise(() =>
          context.db
            .insertInto("media_objects")
            .values({
              contentLength: 12,
              contentType: "image/jpeg",
              fence: 1,
              fingerprint: stored.fingerprint,
              key: orphan,
              kind: "thumbnail",
              operationId: orphanOpId,
              state: "ready",
              userId: "user-1",
            })
            .execute(),
        );
        return { liveKey: live, orphanKey: orphan };
      }),
    );

    const result = await context.runEffect(
      Effect.gen(function* () {
        const lifecycle = yield* LifecycleService;
        return yield* lifecycle.deleteManagedKeys([liveKey, orphanKey]);
      }),
    );

    expect(result.protectedKeys.has(liveKey)).toBe(true);
    expect(result.deletedKeys.has(orphanKey)).toBe(true);

    const rows = await context.db
      .selectFrom("media_objects")
      .select(["key", "state"])
      .where("key", "in", [liveKey, orphanKey])
      .execute();
    const byKey = new Map(rows.map((row) => [row.key, row.state]));
    expect(byKey.get(liveKey)).toBe("ready");
    expect(byKey.get(orphanKey)).toBe("deleted");
  });

  it("reconciles non-terminal preparing and deleting objects", async () => {
    const context = await openContext();
    const opId = "op-reconcile";
    const presentKey = imageObjectKey(opId, 0, "png");
    const missingKey = imageObjectKey(opId, 1, "png");
    const deletingKey = imageObjectKey(opId, 2, "png");

    const storedPresent = await context.runEffect(
      Effect.gen(function* () {
        const storage = yield* StorageModule;
        const a = yield* storage.putImage(
          presentKey,
          makeFile("present.png", "image/png", "present-bytes"),
        );
        yield* storage.putImage(
          deletingKey,
          makeFile("deleting.png", "image/png", "deleting-bytes"),
        );
        return a;
      }),
    );

    await context.db
      .insertInto("media_operations")
      .values({
        fence: 1,
        id: opId,
        kind: "post-create",
        operationKey: "reconcile-key",
        requestFingerprint: fingerprint,
        status: "in-progress",
        userId: "user-1",
      })
      .execute();

    await context.db
      .insertInto("media_objects")
      .values([
        {
          contentLength: 13,
          contentType: "image/png",
          fence: 1,
          fingerprint: storedPresent.fingerprint,
          key: presentKey,
          kind: "image",
          operationId: opId,
          state: "preparing",
          userId: "user-1",
        },
        {
          contentLength: 10,
          contentType: "image/png",
          fence: 1,
          fingerprint,
          key: missingKey,
          kind: "image",
          operationId: opId,
          state: "reserved",
          userId: "user-1",
        },
        {
          contentLength: 14,
          contentType: "image/png",
          fence: 1,
          fingerprint: secondFingerprint,
          key: deletingKey,
          kind: "image",
          operationId: opId,
          state: "deleting",
          userId: "user-1",
        },
      ])
      .execute();

    const reconciled = await context.runEffect(
      Effect.gen(function* () {
        const lifecycle = yield* LifecycleService;
        return yield* lifecycle.reconcileNonTerminal({ operationId: opId });
      }),
    );

    expect(reconciled.adoptedKeys).toEqual([presentKey]);
    expect(reconciled.quarantinedKeys).toEqual([missingKey]);
    expect(reconciled.completedDeleteKeys).toEqual([deletingKey]);
  });

  it("enforces optimistic concurrency via updatePostWithVersionInTransaction", async () => {
    const context = await openContext();
    const post = await context.db
      .insertInto("posts")
      .values({
        description: "v1",
        thumbnailKey: "thumb.jpg",
        title: "Versioned",
        userId: "user-1",
        videoKey: null,
        videoMetadata: {},
      })
      .returningAll()
      .executeTakeFirstOrThrow();

    const conflict = await context.runFailure(
      Effect.gen(function* () {
        const db = yield* (yield* Effect.promise(() => import("../db/context")))
          .KyselyDB;
        return yield* db.transaction((trx) =>
          updatePostWithVersionInTransaction(trx, {
            changes: { title: "Stale" },
            expectedVersion: post.version + 99,
            postId: post.id,
          }),
        );
      }),
    );

    expect(conflict).toBeInstanceOf(PostVersionConflictError);
  });
});
