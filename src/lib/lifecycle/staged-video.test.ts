import { Effect } from "effect";
import { afterEach, describe, expect, it } from "vitest";

import {
  makeServiceTestLayer,
  type MakeServiceTestLayerOptions,
} from "../db/test-utils";
import { MAX_VIDEO_SIZE_BYTES } from "../posts/posts.schema";
import { pendingVideoObjectKey, videoObjectKey } from "../storage/keys";
import {
  StorageModule,
  type UploadedFileHead,
} from "../storage/storage.module";
import {
  LifecycleService,
  LifecycleServiceLive,
  type VerifyStagedVideoInput,
} from "./lifecycle.service";

type LifecycleContext = Awaited<
  ReturnType<typeof makeServiceTestLayer<LifecycleService, never>>
>;

let closeContext: (() => Promise<void>) | undefined;

afterEach(async () => {
  await closeContext?.();
  closeContext = undefined;
});

const openContext = async (options?: MakeServiceTestLayerOptions) => {
  const context = await makeServiceTestLayer(LifecycleServiceLive, options);
  closeContext = context.close;
  return context;
};

const verifyStaged = (input: VerifyStagedVideoInput) =>
  Effect.gen(function* () {
    const lifecycle = yield* LifecycleService;
    return yield* lifecycle.verifyStagedVideo(input);
  });

const discardStaged = (sourceKey: string) =>
  Effect.gen(function* () {
    const lifecycle = yield* LifecycleService;
    return yield* lifecycle.discardStagedVideo(sourceKey);
  });

const headObject = (key: string) =>
  Effect.gen(function* () {
    const storage = yield* StorageModule;
    return yield* storage.headFile(key);
  });

/** Mirrors the browser: presign the staging key, then PUT the bytes through it. */
const stageVideo = async (
  context: LifecycleContext,
  input: {
    readonly bytes: string;
    readonly operationId: string;
    readonly userId: string;
  },
) => {
  const key = pendingVideoObjectKey(input.userId, input.operationId, "mp4");
  const staged = await context.runEffect(
    Effect.gen(function* () {
      const storage = yield* StorageModule;
      return yield* storage.presignDeterministicVideoUpload(
        input.userId,
        key,
        "video/mp4",
      );
    }),
  );
  const response = await fetch(staged.url, {
    body: new File([input.bytes], "clip.mp4", { type: "video/mp4" }),
    headers: staged.requiredHeaders,
    method: "PUT",
  });
  expect(response.ok).toBe(true);
  return key;
};

describe("LifecycleService.verifyStagedVideo", () => {
  it("returns the final identity of a verified staged video and keeps the staging object", async () => {
    const context = await openContext();
    const userId = "staged-user-1";
    const operationId = crypto.randomUUID();
    const sourceKey = await stageVideo(context, {
      bytes: "video bytes",
      operationId,
      userId,
    });

    const staged = await context.runEffect(
      verifyStaged({ operationId, pendingKey: sourceKey, userId }),
    );

    const head = await context.runEffect(headObject(sourceKey));
    expect(head.etag).not.toBeNull();
    expect(staged).toEqual({
      contentLength: "video bytes".length,
      contentType: "video/mp4",
      etag: head.etag,
      fingerprint: `etag:${head.etag}`,
      finalKey: videoObjectKey(operationId, "mp4"),
      sourceKey,
    });
  });

  it("rejects a staging key that belongs to another user without touching it", async () => {
    const context = await openContext();
    const operationId = crypto.randomUUID();
    const sourceKey = await stageVideo(context, {
      bytes: "bytes",
      operationId,
      userId: "staged-user-2",
    });

    const error = await context.runFailure(
      verifyStaged({
        operationId,
        pendingKey: sourceKey,
        userId: "someone-else",
      }),
    );

    expect(error._tag).toBe("ValidationError");
    expect(error.message).toBe("Invalid video upload key");
    const head = await context.runEffect(headObject(sourceKey));
    expect(head.contentLength).toBe("bytes".length);
  });

  it.each([
    "videos/_pending/staged-user-3/../escape.mp4",
    "videos/staged-user-3/final.mp4",
  ])("rejects the malformed key %s", async (pendingKey) => {
    const context = await openContext();

    const error = await context.runFailure(
      verifyStaged({
        operationId: crypto.randomUUID(),
        pendingKey,
        userId: "staged-user-3",
      }),
    );

    expect(error._tag).toBe("ValidationError");
    expect(error.message).toBe("Invalid video upload key");
  });

  it.each([
    [
      "oversized",
      (head: UploadedFileHead): UploadedFileHead => ({
        ...head,
        contentLength: MAX_VIDEO_SIZE_BYTES + 1,
      }),
    ],
    [
      "wrong content type",
      (head: UploadedFileHead): UploadedFileHead => ({
        ...head,
        contentType: "text/html",
      }),
    ],
    [
      "missing ETag",
      (head: UploadedFileHead): UploadedFileHead => ({
        ...head,
        etag: null,
      }),
    ],
  ])(
    "rejects a %s staged video and discards its staging object",
    async (_label, transform) => {
      // Only the head is rewritten: a real object cannot hold these shapes.
      const context = await openContext({
        wrapStorage: (storage) => ({
          ...storage,
          headFile: (key) => storage.headFile(key).pipe(Effect.map(transform)),
        }),
      });
      const userId = "staged-user-4";
      const operationId = crypto.randomUUID();
      const sourceKey = await stageVideo(context, {
        bytes: "video bytes",
        operationId,
        userId,
      });

      const error = await context.runFailure(
        verifyStaged({ operationId, pendingKey: sourceKey, userId }),
      );

      expect(error._tag).toBe("ValidationError");
      expect(error.message).toMatch(
        /^Video upload is invalid: expected video\/mp4/,
      );
      const removed = await context.runFailure(headObject(sourceKey));
      expect(removed).toMatchObject({
        _tag: "StorageError",
        operation: "head",
      });
    },
  );
});

describe("LifecycleService.discardStagedVideo", () => {
  it("removes the staging object and tolerates one that is already gone", async () => {
    const context = await openContext();
    const sourceKey = await stageVideo(context, {
      bytes: "bytes",
      operationId: crypto.randomUUID(),
      userId: "staged-user-5",
    });

    await context.runEffect(discardStaged(sourceKey));

    const removed = await context.runFailure(headObject(sourceKey));
    expect(removed.operation).toBe("head");
    await expect(
      context.runEffect(discardStaged(sourceKey)),
    ).resolves.toBeUndefined();
  });
});
