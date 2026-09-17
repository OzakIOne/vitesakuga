import { Effect, Layer } from "effect";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { startWorkstream3Harness } from "../../../scripts/workstream3-harness";
import { KyselyDB } from "../db/context";
import { makeFromKysely } from "../effect/effect.utils";
import { imageObjectKey } from "../storage/keys";
import { makeRustFSStorageLayerAt } from "../storage/storage.adapter";
import { StorageModule } from "../storage/storage.module";
import {
  LifecycleService,
  LifecycleServiceLive,
  OperationFenceError,
  ObjectNotAdoptableError,
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

const claim = (operationKey: string) =>
  run(
    Effect.gen(function* () {
      const lifecycle = yield* LifecycleService;
      return yield* lifecycle.claimOperation({
        kind: "post-create",
        operationKey,
        requestFingerprint: fingerprint,
        userId: "ws3-user",
      });
    }),
  );

describe("workstream 3 isolated PostgreSQL + RustFS recovery", () => {
  it("elects one operation row across independent PostgreSQL connections", async () => {
    const [a, b] = await Promise.all([claim("race"), claim("race")]);
    expect(a.operationId).toBe(b.operationId);
    expect(new Set([a.outcome, b.outcome])).toEqual(new Set(["claimed"]));
    const rows = await harness.db
      .selectFrom("media_operations")
      .selectAll()
      .execute();
    expect(rows).toHaveLength(1);
  });

  it("fences stale workers after a retry claims the same operation", async () => {
    const first = await claim("fence");
    const second = await claim("fence");
    if (first.outcome !== "claimed" || second.outcome !== "claimed")
      throw new Error("expected claims");
    const error = await run(
      Effect.flip(
        Effect.gen(function* () {
          const lifecycle = yield* LifecycleService;
          return yield* lifecycle.reserveObject({
            contentLength: 1,
            contentType: "image/png",
            fence: first.fence,
            fingerprint,
            key: imageObjectKey(first.operationId, 0, "png"),
            kind: "image",
            operationId: first.operationId,
            userId: "ws3-user",
          });
        }),
      ),
    );
    expect(error).toBeInstanceOf(OperationFenceError);
  });

  it("keeps storage ordering: reserve, upload, ready, then durable finish", async () => {
    const operation = await claim("ordering");
    if (operation.outcome !== "claimed") throw new Error("expected claim");
    const key = imageObjectKey(operation.operationId, 0, "png");
    const stored = await run(
      Effect.gen(function* () {
        const storage = yield* StorageModule;
        return yield* storage.putImage(
          key,
          new File(["ordered"], "image.png", { type: "image/png" }),
        );
      }),
    );
    const object = {
      contentLength: 7,
      contentType: "image/png",
      fence: operation.fence,
      fingerprint: stored.fingerprint,
      key,
      kind: "image" as const,
      operationId: operation.operationId,
      userId: "ws3-user",
    };
    await run(
      Effect.gen(function* () {
        const lifecycle = yield* LifecycleService;
        yield* lifecycle.reserveObject(object);
        yield* lifecycle.markPreparing(object);
        yield* lifecycle.markReady({
          ...object,
          observed: {
            contentLength: 7,
            contentType: "image/png",
            fingerprint: stored.fingerprint,
          },
        });
        return yield* lifecycle.finishOperation({
          fence: operation.fence,
          operationId: operation.operationId,
          result: { imageKeys: [key] },
        });
      }),
    );
    expect(
      (
        await harness.db
          .selectFrom("media_objects")
          .select("state")
          .where("key", "=", key)
          .executeTakeFirstOrThrow()
      ).state,
    ).toBe("ready");
  });

  it("reconciles a response-lost write from RustFS HEAD metadata", async () => {
    const operation = await claim("response-loss");
    if (operation.outcome !== "claimed") throw new Error("expected claim");
    const key = imageObjectKey(operation.operationId, 0, "png");
    const stored = await run(
      Effect.gen(function* () {
        const storage = yield* StorageModule;
        return yield* storage.putImage(
          key,
          new File(["lost"], "image.png", { type: "image/png" }),
        );
      }),
    );
    await harness.db
      .insertInto("media_objects")
      .values({
        contentLength: 4,
        contentType: "image/png",
        fence: operation.fence,
        fingerprint: stored.fingerprint,
        key,
        kind: "image",
        operationId: operation.operationId,
        state: "reserved",
        userId: "ws3-user",
      })
      .execute();
    const result = await run(
      Effect.gen(function* () {
        const lifecycle = yield* LifecycleService;
        return yield* lifecycle.reconcileNonTerminal({
          operationId: operation.operationId,
        });
      }),
    );
    expect(result.adoptedKeys).toEqual([key]);
  });

  it("preserves tombstones and rejects late reuse", async () => {
    const operation = await claim("tombstone");
    if (operation.outcome !== "claimed") throw new Error("expected claim");
    const key = imageObjectKey(operation.operationId, 0, "png");
    const object = {
      contentLength: 4,
      contentType: "image/png",
      fence: operation.fence,
      fingerprint,
      key,
      kind: "image" as const,
      operationId: operation.operationId,
      userId: "ws3-user",
    };
    await run(
      Effect.gen(function* () {
        const lifecycle = yield* LifecycleService;
        yield* lifecycle.reserveObject(object);
        yield* lifecycle.markPreparing(object);
        yield* lifecycle.markReady(object);
        const deleting = yield* lifecycle.beginDelete(object);
        yield* lifecycle.completeDelete({ ...object, fence: deleting.fence });
      }),
    );
    const error = await run(
      Effect.flip(
        Effect.gen(function* () {
          const lifecycle = yield* LifecycleService;
          return yield* lifecycle.reserveObject(object);
        }),
      ),
    );
    expect(error).toBeInstanceOf(ObjectNotAdoptableError);
    expect(
      (
        await harness.db
          .selectFrom("media_objects")
          .select("state")
          .where("key", "=", key)
          .executeTakeFirstOrThrow()
      ).state,
    ).toBe("deleted");
  });
});
