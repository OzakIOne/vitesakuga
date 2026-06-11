import { Effect } from "effect";
import { describe, expect, it } from "vitest";

import { StorageModule } from "./storage.module";
import type { StorageError } from "./storage.module";
import { makeRustFSStorageLayer } from "./storage.rustfs";

const runTest = <A>(effect: Effect.Effect<A, StorageError, StorageModule>) => {
  const { layer } = makeRustFSStorageLayer();
  return Effect.runPromise(effect.pipe(Effect.provide(layer)));
};

describe("StorageModule", () => {
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
