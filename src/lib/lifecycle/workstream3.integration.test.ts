import { Effect, Layer } from "effect";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { startWorkstream3Harness } from "../../../scripts/workstream3-harness";
import { KyselyDB } from "../db/context";
import { makeFromKysely } from "../db/effect-kysely";
import { imageObjectKey } from "../storage/keys";
import { makeRustFSStorageLayerAt } from "../storage/storage.adapter";
import { StorageModule } from "../storage/storage.module";
import {
  LifecycleService,
  LifecycleServiceLive,
  OperationConflictError,
} from "./lifecycle.service";

const fingerprint = "sha256:" + "a".repeat(64);
let harness: Awaited<ReturnType<typeof startWorkstream3Harness>>;
let run: <A, E>(
  effect: Effect.Effect<A, E, LifecycleService | StorageModule>,
) => Promise<A>;

beforeAll(async () => {
  harness = await startWorkstream3Harness();
  const storage = makeRustFSStorageLayerAt({
    accessKeyId: "rustfsadmin",
    bucket: harness.bucket,
    endpoint: harness.storageEndpoint,
    secretAccessKey: "rustfsadmin",
  });
  const baseLayer = Layer.mergeAll(
    Layer.succeed(KyselyDB)(makeFromKysely(harness.db)),
    storage,
  );
  const layer = LifecycleServiceLive.pipe(Layer.provideMerge(baseLayer));
  run = <A, E>(effect: Effect.Effect<A, E, LifecycleService | StorageModule>) =>
    Effect.runPromise(effect.pipe(Effect.provide(layer)));
  await harness.db
    .insertInto("user")
    .values({
      email: "ws3@test.invalid",
      id: "ws3-user",
      name: "WS3",
      username: "ws3",
    })
    .execute();
});

afterAll(async () => {
  await harness?.close();
});

describe("workstream 3 isolated PostgreSQL + RustFS recovery", () => {
  it("elects one operation row across concurrent runOperation calls", async () => {
    const runOp = () =>
      run(
        Effect.gen(function* () {
          const lifecycle = yield* LifecycleService;
          return yield* lifecycle.runOperation({
            kind: "post-create",
            operationKey: "race",
            replay: (result) => Effect.succeed(String(result.postId)),
            request: { payload: { title: "Race" } },
            userId: "ws3-user",
            run: (operation) => Effect.succeed(operation.operationId),
          });
        }),
      );

    const [a, b] = await Promise.all([runOp(), runOp()]);
    expect(a).toBe(b);
    const rows = await harness.db
      .selectFrom("media_operations")
      .selectAll()
      .where("operationKey", "=", "race")
      .execute();
    expect(rows).toHaveLength(1);
  });

  it("rejects conflicting payloads reusing an operationKey", async () => {
    await run(
      Effect.gen(function* () {
        const lifecycle = yield* LifecycleService;
        return yield* lifecycle.runOperation({
          kind: "post-create",
          operationKey: "conflict-key",
          replay: () => Effect.succeed("replayed"),
          request: { payload: { title: "One" } },
          userId: "ws3-user",
          run: () => Effect.succeed("claimed"),
        });
      }),
    );

    const error = await run(
      Effect.flip(
        Effect.gen(function* () {
          const lifecycle = yield* LifecycleService;
          return yield* lifecycle.runOperation({
            kind: "post-create",
            operationKey: "conflict-key",
            replay: () => Effect.succeed("replayed"),
            request: { payload: { title: "Two" } },
            userId: "ws3-user",
            run: () => Effect.succeed("claimed"),
          });
        }),
      ),
    );
    expect(error).toBeInstanceOf(OperationConflictError);
  });

  it("reconciles a response-lost write from RustFS HEAD metadata", async () => {
    const opId = "ws3-reconcile-op";
    const key = imageObjectKey(opId, 0, "png");
    const stored = await run(
      Effect.gen(function* () {
        const storage = yield* StorageModule;
        return yield* storage.putImage(
          key,
          new File(["ws3-bytes"], "ws3.png", { type: "image/png" }),
        );
      }),
    );

    await harness.db
      .insertInto("media_operations")
      .values({
        fence: 1,
        id: opId,
        kind: "post-create",
        operationKey: "ws3-reconcile",
        requestFingerprint: fingerprint,
        status: "in-progress",
        userId: "ws3-user",
      })
      .execute();

    await harness.db
      .insertInto("media_objects")
      .values({
        contentLength: 9,
        contentType: "image/png",
        fence: 1,
        fingerprint: stored.fingerprint,
        key,
        kind: "image",
        operationId: opId,
        state: "preparing",
        userId: "ws3-user",
      })
      .execute();

    const result = await run(
      Effect.gen(function* () {
        const lifecycle = yield* LifecycleService;
        return yield* lifecycle.reconcileNonTerminal({ operationId: opId });
      }),
    );

    expect(result.adoptedKeys).toEqual([key]);
  });

  it("deletes unreferenced ready objects and preserves deletion tombstones", async () => {
    const opId = "ws3-tombstone-op";
    const key = imageObjectKey(opId, 0, "png");
    const stored = await run(
      Effect.gen(function* () {
        const storage = yield* StorageModule;
        return yield* storage.putImage(
          key,
          new File(["gone-bytes"], "gone.png", { type: "image/png" }),
        );
      }),
    );

    await harness.db
      .insertInto("media_operations")
      .values({
        fence: 1,
        id: opId,
        kind: "post-create",
        operationKey: "ws3-tombstone",
        requestFingerprint: fingerprint,
        status: "completed",
        userId: "ws3-user",
      })
      .execute();

    await harness.db
      .insertInto("media_objects")
      .values({
        contentLength: 10,
        contentType: "image/png",
        fence: 1,
        fingerprint: stored.fingerprint,
        key,
        kind: "image",
        operationId: opId,
        state: "ready",
        userId: "ws3-user",
      })
      .execute();

    const deleted = await run(
      Effect.gen(function* () {
        const lifecycle = yield* LifecycleService;
        return yield* lifecycle.deleteManagedKeys([key]);
      }),
    );

    expect(deleted.deletedKeys.has(key)).toBe(true);
    const row = await harness.db
      .selectFrom("media_objects")
      .select("state")
      .where("key", "=", key)
      .executeTakeFirstOrThrow();
    expect(row.state).toBe("deleted");
  });
});
