import { Schema } from "effect";

import type { MediaOperationKind } from "../db/schema/sakuga.schema";

const URL_PATTERN = /^https?:\/\//i;
const MAX_STORAGE_KEY_LENGTH = 512;

// Operation rows persist object keys only: presigned URLs and large blobs must
// never reach the database, so every key field shares these invariants.
const storageKeySchema = Schema.String.pipe(
  Schema.check(
    Schema.isNonEmpty(),
    Schema.isMaxLength(MAX_STORAGE_KEY_LENGTH),
    Schema.makeFilter((key: string) =>
      URL_PATTERN.test(key)
        ? "Operation results must store storage keys, not URLs"
        : undefined,
    ),
  ),
);

const postCreateResultSchema = Schema.Struct({
  imageKeys: Schema.Array(storageKeySchema),
  postId: Schema.Number,
  thumbnailKey: storageKeySchema,
  videoKey: Schema.optionalKey(storageKeySchema),
});

const postUpdateResultSchema = Schema.Struct({
  postId: Schema.Number,
});

const videoSwapResultSchema = Schema.Struct({
  postId: Schema.Number,
  videoKey: storageKeySchema,
});

const editProposeResultSchema = Schema.Struct({
  editId: Schema.Number,
});

const editApplyResultSchema = Schema.Struct({
  postId: Schema.Number,
});

export const operationResultSchemas = {
  "post-create": postCreateResultSchema,
  "post-update": postUpdateResultSchema,
  "video-replace": videoSwapResultSchema,
  "video-restore": videoSwapResultSchema,
  "edit-propose": editProposeResultSchema,
  "edit-apply": editApplyResultSchema,
} as const satisfies Record<MediaOperationKind, Schema.Top>;

export type OperationResultOf<Kind extends MediaOperationKind> =
  (typeof operationResultSchemas)[Kind]["Type"];

export type MediaOperationResult = OperationResultOf<MediaOperationKind>;
