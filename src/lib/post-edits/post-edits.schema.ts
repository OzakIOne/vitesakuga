import { Schema } from "effect";

import { PostId } from "../ids";

/**
 * Fields an edit suggestion may change. Deliberately narrow: media keys
 * (video/thumbnail swap) belong to the video-replacement flow, and tag
 * relinking has its own pipeline. The filter requires at least one field so
 * empty suggestions cannot clog the review queue.
 */
const PostEditPayloadFields = Schema.Struct({
  animeTitle: Schema.optionalKey(Schema.NullOr(Schema.String)),
  content: Schema.optionalKey(Schema.String),
  episodeNumber: Schema.optionalKey(Schema.NullOr(Schema.Number)),
  seasonNumber: Schema.optionalKey(Schema.NullOr(Schema.Number)),
  source: Schema.optionalKey(Schema.NullOr(Schema.String)),
  title: Schema.optionalKey(
    Schema.String.pipe(
      Schema.check(Schema.isMinLength(1, { message: "Title is required" })),
    ),
  ),
});

// Derived from the base struct alone so the "at least one field" filter below
// can reference the type without a circular definition.
export type PostEditPayload = Schema.Schema.Type<typeof PostEditPayloadFields>;

export const postEditPayloadSchema = PostEditPayloadFields.pipe(
  Schema.check(
    Schema.makeFilter((payload: PostEditPayload): string | undefined =>
      Object.keys(payload).length > 0
        ? undefined
        : "A suggestion must change at least one field",
    ),
  ),
);

/**
 * Payload read back from the `post_edits.payload` json column. The driver
 * returns an already-parsed JSON object, so this is the I/O boundary where
 * the persisted shape gets re-validated against the schema.
 */
export const decodePostEditPayload = (raw: {
  readonly animeTitle?: string | null;
  readonly content?: string;
  readonly episodeNumber?: number | null;
  readonly seasonNumber?: number | null;
  readonly source?: string | null;
  readonly title?: string;
}): PostEditPayload => Schema.decodeUnknownSync(postEditPayloadSchema)(raw);

export const proposeEditSchema = Schema.Struct({
  payload: postEditPayloadSchema,
  postId: PostId,
});

export const editIdSchema = Schema.Struct({ editId: Schema.Number });

export const fetchPostEditsSchema = Schema.Struct({
  postId: PostId,
});
