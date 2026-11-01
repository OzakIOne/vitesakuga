import { Effect } from "effect";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { makeStorageKeyTracker } from "../db/test-utils";
import { imageContentType, videoContentType } from "./content-type";
import {
  imageObjectKey,
  pendingVideoObjectKey,
  thumbnailObjectKey,
  videoObjectKey,
} from "./keys";
import { StorageModule } from "./storage.module";
import type { StorageError } from "./storage.module";

const runTest = <A, E = StorageError>(
  effect: Effect.Effect<A, E, StorageModule>,
) => Effect.runPromise(effect.pipe(Effect.provide(tracked.storageLayer)));

// The bucket is shared across parallel workers: each test journals the keys
// it creates through its own storage operations and cleanup deletes exactly
// those — a bucket-wide listing sweep would race with other workers' uploads.
let tracked: ReturnType<typeof makeStorageKeyTracker>;

beforeEach(() => {
  tracked = makeStorageKeyTracker();
});

afterEach(() => tracked.tracker.cleanup(), 60_000);

describe("StorageModule", () => {
  describe("canonical content types", () => {
    it.each([
      [".MP4", "video/mp4"],
      [" MKV ", "video/x-matroska"],
      [".PNG", "image/png"],
      [" JPEG ", "image/jpeg"],
    ] as const)("maps %s to %s", (extension, expected) => {
      const actual = expected.startsWith("video/")
        ? videoContentType(extension)
        : imageContentType(extension);
      expect(actual).toBe(expected);
    });
  });

  describe("headFile", () => {
    it("returns the stored size and content type", async () => {
      const key = imageObjectKey("headfile-operation", 0, "png");
      await runTest(
        Effect.gen(function* () {
          const storage = yield* StorageModule;
          return yield* storage.putImage(
            key,
            new File(["test content"], "pic.png", { type: "image/png" }),
          );
        }),
      );

      const head = await runTest(
        Effect.gen(function* () {
          const storage = yield* StorageModule;
          return yield* storage.headFile(key);
        }),
      );

      expect(head.contentLength).toBe(12);
      expect(head.contentType).toBe("image/png");
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

  describe("listKeys", () => {
    it("lists every key under a prefix and nothing outside it", async () => {
      const operationId = `list-${crypto.randomUUID()}`;
      const imageKeys = [
        imageObjectKey(operationId, 0, "png"),
        imageObjectKey(operationId, 1, "png"),
      ];
      await runTest(
        Effect.gen(function* () {
          const storage = yield* StorageModule;
          for (const key of imageKeys) {
            yield* storage.putImage(
              key,
              new File(["x"], "pic.png", { type: "image/png" }),
            );
          }
          // A sibling namespace that must never appear in the listing.
          yield* storage.putThumbnail(
            thumbnailObjectKey(operationId),
            new File(["x"], "thumb.jpg", { type: "image/jpeg" }),
          );
        }),
      );

      const keys = await runTest(
        Effect.gen(function* () {
          const storage = yield* StorageModule;
          return yield* storage.listKeys(`media/image/${operationId}/`);
        }),
      );

      expect([...keys].sort()).toEqual([...imageKeys].sort());
    });

    it("assembles listings that span multiple S3 result pages", async () => {
      // S3 caps ListObjectsV2 at 1000 keys per page, so only >1000 objects
      // under one prefix actually exercise the ContinuationToken loop. The
      // per-run operation id keeps the prefix free of leftovers from other runs.
      const totalCount = 1001;
      const operationId = `paging-${crypto.randomUUID().slice(0, 8)}`;
      const prefix = `media/image/${operationId}/`;
      const uploaded = await runTest(
        Effect.gen(function* () {
          const storage = yield* StorageModule;
          // The 1001 PUTs are independent; bounded concurrency keeps the
          // wall time sane without hammering the local store.
          return yield* Effect.forEach(
            Array.from({ length: totalCount }, (_, i) => i),
            (i) =>
              storage
                .putImage(
                  imageObjectKey(operationId, i, "png"),
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

  describe("deterministic lifecycle primitives", () => {
    it("hashes image bytes before a non-overwriting PUT and safely replays it", async () => {
      const key = imageObjectKey("storage-operation", 0, "png");
      const file = new File(["image bytes"], "image.png", {
        type: "image/png",
      });
      const first = await runTest(
        Effect.gen(function* () {
          const storage = yield* StorageModule;
          return yield* storage.putImage(key, file);
        }),
      );
      const second = await runTest(
        Effect.gen(function* () {
          const storage = yield* StorageModule;
          return yield* storage.putImage(key, file);
        }),
      );
      expect(first).toEqual(second);
      expect(first.fingerprint).toMatch(/^sha256:[0-9a-f]{64}$/);
      const head = await runTest(
        Effect.gen(function* () {
          const storage = yield* StorageModule;
          return yield* storage.headFile(key);
        }),
      );
      expect(head.metadataFingerprint).toBe(first.fingerprint);
      expect(head.etag).toBe(first.etag);
      expect(head.contentLength).toBe("image bytes".length);
      expect(head.contentType).toBe("image/png");

      const conflict = await runTest(
        Effect.flip(
          Effect.gen(function* () {
            const storage = yield* StorageModule;
            return yield* storage.putImage(
              key,
              new File(["different bytes"], "image.png", { type: "image/png" }),
            );
          }),
        ),
      );
      expect(conflict._tag).toBe("StorageError");
      expect(conflict.operation).toBe("upload");
    });

    it("hashes thumbnails and keeps the server content type", async () => {
      const key = thumbnailObjectKey("storage-thumbnail-operation");
      const result = await runTest(
        Effect.gen(function* () {
          const storage = yield* StorageModule;
          return yield* storage.putThumbnail(
            key,
            new File(["thumbnail bytes"], "thumb.png", { type: "text/html" }),
          );
        }),
      );
      const head = await runTest(
        Effect.gen(function* () {
          const storage = yield* StorageModule;
          return yield* storage.headFile(key);
        }),
      );
      expect(result.fingerprint).toMatch(/^sha256:[0-9a-f]{64}$/);
      expect(head.metadataFingerprint).toBe(result.fingerprint);
      expect(head.contentType).toBe("image/jpeg");
    });

    it("keeps equal content fingerprints while operation-derived keys differ", async () => {
      const file = new File(["same image"], "image.png", { type: "image/png" });
      const first = await runTest(
        Effect.gen(function* () {
          const storage = yield* StorageModule;
          return yield* storage.putImage(
            imageObjectKey("same-content-operation-a", 0, "png"),
            file,
          );
        }),
      );
      const second = await runTest(
        Effect.gen(function* () {
          const storage = yield* StorageModule;
          return yield* storage.putImage(
            imageObjectKey("same-content-operation-b", 0, "png"),
            file,
          );
        }),
      );
      expect(first.fingerprint).toBe(second.fingerprint);
      expect(first.key).not.toBe(second.key);
    });

    it("presigns only deterministic staging keys and promotes with a pinned ETag", async () => {
      const sourceKey = pendingVideoObjectKey(
        "storage-video-user",
        "storage-video-operation",
        "mp4",
      );
      const staged = await runTest(
        Effect.gen(function* () {
          const storage = yield* StorageModule;
          return yield* storage.presignDeterministicVideoUpload(
            "storage-video-user",
            sourceKey,
            "video/mp4",
          );
        }),
      );
      expect(staged.requiredHeaders).toEqual({
        "content-type": "video/mp4",
        "if-none-match": "*",
      });
      const response = await fetch(staged.url, {
        body: new File(["video bytes"], "clip.mp4", { type: "video/mp4" }),
        headers: staged.requiredHeaders,
        method: "PUT",
      });
      expect(response.ok).toBe(true);

      const sourceHead = await runTest(
        Effect.gen(function* () {
          const storage = yield* StorageModule;
          return yield* storage.headFile(sourceKey);
        }),
      );
      expect(sourceHead.etag).not.toBeNull();
      const finalKey = videoObjectKey("storage-video-operation", "mp4");
      const copied = await runTest(
        Effect.gen(function* () {
          const storage = yield* StorageModule;
          return yield* storage.copyVideoIfMatch(
            sourceKey,
            sourceHead.etag!,
            finalKey,
          );
        }),
      );
      const replay = await runTest(
        Effect.gen(function* () {
          const storage = yield* StorageModule;
          return yield* storage.copyVideoIfMatch(
            sourceKey,
            sourceHead.etag!,
            finalKey,
          );
        }),
      );
      expect(copied.key).toBe(finalKey);
      expect(replay).toEqual(copied);

      const invalid = await runTest(
        Effect.flip(
          Effect.gen(function* () {
            const storage = yield* StorageModule;
            return yield* storage.presignDeterministicVideoUpload(
              "storage-video-user",
              "media/video/not-a-staging-key/0000.mp4",
              "video/mp4",
            );
          }),
        ),
      );
      expect(invalid.operation).toBe("presign");
    });
  });
});
