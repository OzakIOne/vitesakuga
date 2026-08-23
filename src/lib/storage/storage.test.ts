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

  describe("headFile", () => {
    it("returns the stored size and content type", async () => {
      const file = new File(["test content"], "clip.mp4", {
        type: "video/mp4",
      });
      const { key } = await runTest(
        Effect.gen(function* () {
          const storage = yield* StorageModule;
          return yield* storage.uploadVideo("user-123", file);
        }),
      );

      const head = await runTest(
        Effect.gen(function* () {
          const storage = yield* StorageModule;
          return yield* storage.headFile(key);
        }),
      );

      expect(head.contentLength).toBe(12);
      expect(head.contentType).toBe("video/mp4");
    });
  });

  describe("presignVideoUpload", () => {
    it("returns a staging key, content type and signed PUT URL", async () => {
      const result = await runTest(
        Effect.gen(function* () {
          const storage = yield* StorageModule;
          return yield* storage.presignVideoUpload("user-123", "mp4");
        }),
      );

      expect(result.key).toMatch(
        /^videos\/_pending\/user-123\/[a-f0-9-]+\.mp4$/,
      );
      expect(result.contentType).toBe("video/mp4");
      expect(result.url).toContain(result.key);
      expect(result.url).toContain("X-Amz-Signature=");
      expect(result.url).toContain("X-Amz-Expires=900");
    });
  });

  describe("finalizeVideoUpload", () => {
    const putPendingUpload = async () => {
      const staged = await runTest(
        Effect.gen(function* () {
          const storage = yield* StorageModule;
          return yield* storage.presignVideoUpload("user-123", "mp4");
        }),
      );
      // Mirror the browser flow: PUT through the presigned URL with the
      // signed content type.
      const response = await fetch(staged.url, {
        method: "PUT",
        body: new File(["test content"], "clip.mp4", { type: "video/mp4" }),
        headers: { "Content-Type": staged.contentType },
      });
      expect(response.ok).toBe(true);
      return staged.key;
    };

    it("copies the object to its final key and clears the staging copy", async () => {
      const pendingKey = await putPendingUpload();

      const { key: finalKey } = await runTest(
        Effect.gen(function* () {
          const storage = yield* StorageModule;
          return yield* storage.finalizeVideoUpload(pendingKey);
        }),
      );

      expect(finalKey).toMatch(/^videos\/user-123\/[a-f0-9-]+\.mp4$/);
      // The promoted object is fully readable at its final location.
      const head = await runTest(
        Effect.gen(function* () {
          const storage = yield* StorageModule;
          return yield* storage.headFile(finalKey);
        }),
      );
      expect(head.contentLength).toBe(12);
      expect(head.contentType).toBe("video/mp4");
      // The staging copy is gone.
      await expect(
        runTest(
          Effect.gen(function* () {
            const storage = yield* StorageModule;
            return yield* storage.headFile(pendingKey);
          }),
        ),
      ).rejects.toThrow();
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
