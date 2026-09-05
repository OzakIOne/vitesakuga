import { Effect } from "effect";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { makeStorageKeyTracker } from "../db/test-utils";
import { StorageModule } from "./storage.module";
import type { StorageError } from "./storage.module";

const runTest = <A>(effect: Effect.Effect<A, StorageError, StorageModule>) =>
  Effect.runPromise(effect.pipe(Effect.provide(tracked.storageLayer)));

const uploadImageKey = (name: string) =>
  runTest(
    Effect.gen(function* () {
      const storage = yield* StorageModule;
      return yield* storage.uploadImage(
        "user-list",
        new File(["x"], name, { type: "image/png" }),
      );
    }),
  ).then(({ key }) => key);

const uploadVideoKey = () =>
  runTest(
    Effect.gen(function* () {
      const storage = yield* StorageModule;
      return yield* storage.uploadVideo(
        "user-list",
        new File(["x"], "clip.mp4", { type: "video/mp4" }),
      );
    }),
  ).then(({ key }) => key);

// The bucket is shared across parallel workers: each test journals the keys
// it creates through its own storage operations and cleanup deletes exactly
// those — a bucket-wide listing sweep would race with other workers' uploads.
let tracked: ReturnType<typeof makeStorageKeyTracker>;

beforeEach(() => {
  tracked = makeStorageKeyTracker();
});

afterEach(() => tracked.tracker.cleanup(), 60_000);

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
      // The staging copy is gone: the head failure is the typed storage
      // error for the `head` operation on exactly the requested key.
      const error = await runTest(
        Effect.flip(
          Effect.gen(function* () {
            const storage = yield* StorageModule;
            return yield* storage.headFile(pendingKey);
          }),
        ),
      );
      expect(error._tag).toBe("StorageError");
      expect(error.operation).toBe("head");
      expect(error.key).toBe(pendingKey);
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

  describe("uploadImage", () => {
    it.each(["jpg", "png", "webp"] as const)(
      "stores post images under images/{userId}/ preserving the .%s extension",
      async (ext) => {
        const file = new File(["image bytes"], `pic.${ext}`, {
          type: "image/png",
        });
        const { key } = await runTest(
          Effect.gen(function* () {
            const storage = yield* StorageModule;
            return yield* storage.uploadImage("user-img", file);
          }),
        );

        expect(key).toMatch(
          new RegExp(`^images\\/user-img\\/[a-f0-9-]+\\.${ext}$`),
        );
      },
    );

    it("derives the stored content type from the extension, not the client File.type", async () => {
      const file = new File(["png bytes"], "pic.png", {
        // Spoofed client type must not leak into the bucket.
        type: "text/html",
      });
      const { key } = await runTest(
        Effect.gen(function* () {
          const storage = yield* StorageModule;
          return yield* storage.uploadImage("user-img", file);
        }),
      );

      const head = await runTest(
        Effect.gen(function* () {
          const storage = yield* StorageModule;
          return yield* storage.headFile(key);
        }),
      );
      expect(head.contentType).toBe("image/png");
      expect(head.contentLength).toBe("png bytes".length);
    });
  });

  describe("listKeys", () => {
    it("lists every key under a prefix and nothing outside it", async () => {
      const imageKeys = [
        await uploadImageKey("a.png"),
        await uploadImageKey("b.png"),
      ];
      // A sibling namespace that must never appear in the listing.
      await uploadVideoKey();

      const keys = await runTest(
        Effect.gen(function* () {
          const storage = yield* StorageModule;
          return yield* storage.listKeys("images/user-list/");
        }),
      );

      expect(keys.sort()).toEqual(imageKeys.sort());
    });

    it("assembles listings that span multiple S3 result pages", async () => {
      // S3 caps ListObjectsV2 at 1000 keys per page, so only >1000 objects
      // under one prefix actually exercise the ContinuationToken loop. The
      // per-run user id keeps the prefix free of leftovers from other runs.
      const totalCount = 1001;
      const userId = `user-paging-${crypto.randomUUID().slice(0, 8)}`;
      const prefix = `images/${userId}/`;
      const uploaded = await runTest(
        Effect.gen(function* () {
          const storage = yield* StorageModule;
          // The 1001 PUTs are independent; bounded concurrency keeps the
          // wall time sane without hammering the local store.
          return yield* Effect.forEach(
            Array.from({ length: totalCount }, (_, i) => i),
            (i) =>
              storage
                .uploadImage(
                  userId,
                  new File(["x"], `bulk-${i}.png`, { type: "image/png" }),
                )
                .pipe(Effect.map(({ key }) => key)),
            { concurrency: 25 },
          );
        }),
      );
      const keys = await runTest(
        Effect.gen(function* () {
          const storage = yield* StorageModule;
          // Under load the local store's listing index can lag the last
          // writes; poll until the paginated result covers the full static
          // bucket, then assert the pagination contract on a stable state.
          let listed = yield* storage.listKeys(prefix);
          for (
            let attempt = 0;
            attempt < 15 && listed.length !== totalCount;
            attempt += 1
          ) {
            yield* Effect.sleep("1 second");
            listed = yield* storage.listKeys(prefix);
          }
          return listed;
        }),
      );

      expect(new Set(keys).size).toBe(keys.length);
      expect(keys.every((key) => key.startsWith(prefix))).toBe(true);
      // Every uploaded object is listed exactly once — across page borders.
      expect(new Set(keys)).toEqual(new Set(uploaded));
      expect(keys).toHaveLength(totalCount);
    }, 60_000);
  });
});
