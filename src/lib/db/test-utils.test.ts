import { Effect, Layer } from "effect";
import { expect, it } from "vitest";

import { makeRustFSStorageLayer } from "../storage/storage.adapter";
import { StorageError, StorageModule } from "../storage/storage.module";
import { makeStorageKeyTracker } from "./test-utils";

it("retries failed cleanup keys while keeping successful deletions complete", async () => {
  let failDeletion = true;
  let failingKey: string | undefined;
  const live = Layer.effect(
    StorageModule,
    Effect.gen(function* () {
      const storage = yield* StorageModule;
      return {
        ...storage,
        deleteFile: (key: string) =>
          Effect.suspend(() =>
            failDeletion && key === failingKey
              ? Effect.fail(
                  new StorageError({
                    operation: "delete",
                    key,
                    cause: new Error("transient"),
                    message: "Injected transient deletion failure",
                  }),
                )
              : storage.deleteFile(key),
          ),
      };
    }).pipe(Effect.provide(makeRustFSStorageLayer())),
  );
  const { storageLayer, tracker } = makeStorageKeyTracker(live);
  const storage = await Effect.runPromise(
    StorageModule.pipe(Effect.provide(storageLayer)),
  );
  const { key } = await Effect.runPromise(
    storage.uploadVideo("cleanup-retry", new File(["bytes"], "clip.mp4")),
  );
  failingKey = key;
  const other = await Effect.runPromise(
    storage.uploadVideo("cleanup-retry", new File(["other"], "other.mp4")),
  );
  try {
    await expect(tracker.cleanup()).rejects.toThrow("Storage cleanup failed");
    expect(tracker.createdKeys).toEqual([key]);
    expect(
      (await Effect.runPromise(Effect.flip(storage.headFile(other.key))))
        .operation,
    ).toBe("head");
    expect((await Effect.runPromise(storage.headFile(key))).contentLength).toBe(
      5,
    );
    failDeletion = false;
    await tracker.cleanup();
    expect(tracker.createdKeys).toEqual([]);
    const error = await Effect.runPromise(Effect.flip(storage.headFile(key)));
    expect(error.operation).toBe("head");
    await expect(tracker.cleanup()).resolves.toBeUndefined();
  } finally {
    failDeletion = false;
    await tracker.cleanup();
  }
});
