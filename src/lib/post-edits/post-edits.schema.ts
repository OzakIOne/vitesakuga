import { Schema } from "effect";

import { PostId } from "../ids";
// Edit suggestions end up on the post exactly like a direct edit, so the
// payload must pass through the same sanitization and URL invariants
// (security audit M1 — approval used to bypass them).
import { HttpsUrl, MinLen3, sanitizeString } from "../posts/posts.schema";

/**
 * Fields an edit suggestion may change. Deliberately narrow: media keys
 * (video/thumbnail swap) belong to the video-replacement flow, and tag
 * relinking has its own pipeline. The filter requires at least one field so
 * empty suggestions cannot clog the review queue.
 *
 * Text fields are sanitized and length-capped and `source` must be an
 * http(s) URL — identical to `updatePostInputSchema` — so peer approval can
 * never smuggle content a direct edit would reject.
 */
const PostEditPayloadFields = Schema.Struct({
  animeTitle: Schema.optionalKey(Schema.NullOr(sanitizeString(Schema.String))),
  chapterNumber: Schema.optionalKey(Schema.NullOr(Schema.Number)),
  description: Schema.optionalKey(
    sanitizeString(Schema.String.pipe(Schema.check(MinLen3))),
  ),
  episodeNumber: Schema.optionalKey(Schema.NullOr(Schema.Number)),
  seasonNumber: Schema.optionalKey(Schema.NullOr(Schema.Number)),
  source: Schema.optionalKey(Schema.NullOr(HttpsUrl)),
  title: Schema.optionalKey(
    sanitizeString(Schema.String.pipe(Schema.check(MinLen3))),
  ),
  volumeNumber: Schema.optionalKey(Schema.NullOr(Schema.Number)),
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
  readonly chapterNumber?: number | null;
  readonly description?: string;
  readonly episodeNumber?: number | null;
  readonly seasonNumber?: number | null;
  readonly source?: string | null;
  readonly title?: string;
  readonly volumeNumber?: number | null;
}): PostEditPayload => Schema.decodeUnknownSync(postEditPayloadSchema)(raw);

export const proposeEditSchema = Schema.Struct({
  payload: postEditPayloadSchema,
  postId: PostId,
});

export const editIdSchema = Schema.Struct({ editId: Schema.Number });

export const fetchPostEditsSchema = Schema.Struct({
  postId: PostId,
});
