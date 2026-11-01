import { Effect } from "effect";

import { ValidationError } from "../errors";
import { MAX_VIDEO_SIZE_BYTES } from "../posts/posts.schema";
import { videoContentType } from "../storage/content-type";
import {
  isDeterministicPendingVideoKey,
  videoObjectKey,
} from "../storage/keys";
import type { StorageModule } from "../storage/storage.module";
import { isUploadedVideoValid } from "../storage/upload-policy";

const PENDING_EXTENSION_PATTERN = /\.([a-z0-9]{1,12})$/;

/** A verified staged video and the final identity it is promoted to. */
export type StagedVideo = {
  readonly contentLength: number;
  readonly contentType: string;
  readonly etag: string;
  readonly fingerprint: string;
  readonly finalKey: string;
  readonly sourceKey: string;
};

/** Best-effort: a leftover staging object expires through the bucket lifecycle rule. */
export const discardStagedVideo = Effect.fn("StagedVideo.discard")(
  function* (input: {
    readonly sourceKey: string;
    readonly storage: StorageModule["Service"];
  }) {
    yield* input.storage.deleteFile(input.sourceKey).pipe(Effect.ignore);
  },
);

/**
 * Verifies a direct-to-R2 upload that the caller staged under its own
 * deterministic key, and derives the final key it is promoted to. Invalid
 * objects are discarded here, so every caller rejects them the same way.
 */
export const verifyStagedVideo = Effect.fn("StagedVideo.verify")(
  function* (input: {
    readonly operationId: string;
    readonly pendingKey: string;
    readonly storage: StorageModule["Service"];
    readonly userId: string;
  }) {
    if (!isDeterministicPendingVideoKey(input.pendingKey, input.userId)) {
      return yield* new ValidationError({
        message: "Invalid video upload key",
      });
    }

    const extension =
      PENDING_EXTENSION_PATTERN.exec(input.pendingKey)?.[1] ?? "";
    const expectedContentType = videoContentType(extension);
    const head = yield* input.storage.headFile(input.pendingKey).pipe(
      Effect.mapError(
        (error) =>
          new ValidationError({
            cause: error,
            message: `Video upload could not be verified: ${error.message}`,
          }),
      ),
    );

    if (!isUploadedVideoValid(head, expectedContentType)) {
      yield* discardStagedVideo({
        sourceKey: input.pendingKey,
        storage: input.storage,
      });
      return yield* new ValidationError({
        message: `Video upload is invalid: expected ${expectedContentType}, at most ${MAX_VIDEO_SIZE_BYTES / (1024 * 1024)} MB`,
      });
    }

    return {
      contentLength: head.contentLength,
      contentType: head.contentType,
      etag: head.etag,
      fingerprint: head.metadataFingerprint ?? `etag:${head.etag}`,
      finalKey: videoObjectKey(input.operationId, extension),
      sourceKey: input.pendingKey,
    } satisfies StagedVideo;
  },
);
