import { Effect, Layer } from "effect";
import { describe, expect, it } from "vitest";

import { StorageModule } from "./storage.module";
import type { StorageError } from "./storage.module";

export const makeTestStorageLayer = () => {
  const store = new Map<string, Uint8Array>();

  const layer = Layer.succeed(StorageModule)({
    deleteFile: (key) =>
      Effect.sync(() => {
        store.delete(key);
      }),
    uploadThumbnail: (userId, file) =>
      Effect.gen(function* () {
        const key = `thumbnails/${userId}/${crypto.randomUUID()}.jpg`;
        const arrayBuffer = yield* Effect.promise(() => file.arrayBuffer());
        store.set(key, new Uint8Array(arrayBuffer));
        return { key };
      }),
    uploadVideo: (userId, file) =>
      Effect.gen(function* () {
        const ext = file.name.split(".").pop() ?? "mp4";
        const key = `videos/${userId}/${crypto.randomUUID()}.${ext}`;
        const arrayBuffer = yield* Effect.promise(() => file.arrayBuffer());
        store.set(key, new Uint8Array(arrayBuffer));
        return { key };
      }),
  });

  return { layer, store } as const;
};

describe("StorageModule", () => {
  const runTest = <A>(
    effect: Effect.Effect<A, StorageError, StorageModule>,
  ) => {
    const { layer } = makeTestStorageLayer();
    return Effect.runPromise(effect.pipe(Effect.provide(layer)));
  };

  describe("uploadVideo", () => {
    it("returns a key with videos/ prefix and user ID", async () => {
      const file = new File(["test content"], "clip.mp4", {
        type: "video/mp4",
      });
      const result = await runTest(
        Effect.gen(function* () {
          const storage = yield* StorageModule;
          return yield* storage.uploadVideo("user-123", file);
        }),
      );

      expect(result.key).toMatch(/^videos\/user-123\/[a-f0-9-]+\.mp4$/);
    });

    it("preserves the original file extension", async () => {
      const file = new File(["test"], "clip.mkv", { type: "video/x-matroska" });
      const result = await runTest(
        Effect.gen(function* () {
          const storage = yield* StorageModule;
          return yield* storage.uploadVideo("user-123", file);
        }),
      );

      expect(result.key).toMatch(/\.mkv$/);
    });

    it("uses the full name as extension when file has no dot", async () => {
      const file = new File(["test"], "clip", { type: "video/mp4" });
      const result = await runTest(
        Effect.gen(function* () {
          const storage = yield* StorageModule;
          return yield* storage.uploadVideo("user-123", file);
        }),
      );

      expect(result.key).toMatch(/^videos\/user-123\/[a-f0-9-]+\.clip$/);
    });

    it("stores file content in memory", async () => {
      const content = new Uint8Array([1, 2, 3, 4]);
      const file = new File([content], "clip.mp4", { type: "video/mp4" });
      const { layer, store } = makeTestStorageLayer();

      await Effect.runPromise(
        Effect.gen(function* () {
          const storage = yield* StorageModule;
          const result = yield* storage.uploadVideo("user-123", file);
          expect(store.has(result.key)).toBe(true);
          expect(store.get(result.key)).toEqual(content);
        }).pipe(Effect.provide(layer)),
      );
    });
  });

  describe("uploadThumbnail", () => {
    it("returns a key with thumbnails/ prefix and jpg extension", async () => {
      const file = new File(["thumb"], "thumb.png", { type: "image/png" });
      const result = await runTest(
        Effect.gen(function* () {
          const storage = yield* StorageModule;
          return yield* storage.uploadThumbnail("user-456", file);
        }),
      );

      expect(result.key).toMatch(/^thumbnails\/user-456\/[a-f0-9-]+\.jpg$/);
    });
  });

  describe("deleteFile", () => {
    it("removes the file from storage", async () => {
      const file = new File(["content"], "clip.mp4", { type: "video/mp4" });
      const { layer, store } = makeTestStorageLayer();

      await Effect.runPromise(
        Effect.gen(function* () {
          const storage = yield* StorageModule;
          const { key } = yield* storage.uploadVideo("user-123", file);
          expect(store.has(key)).toBe(true);

          yield* storage.deleteFile(key);
          expect(store.has(key)).toBe(false);
        }).pipe(Effect.provide(layer)),
      );
    });

    it("succeeds silently when key does not exist", async () => {
      await runTest(
        Effect.gen(function* () {
          const storage = yield* StorageModule;
          yield* storage.deleteFile("nonexistent/key.jpg");
        }),
      );
    });
  });
});
