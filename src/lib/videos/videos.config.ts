import { Schema } from "effect";

/** How long a replaced video stays restorable (admin GC window). */
export const REVISION_RETENTION_DAYS = 90;

export const DAY_MS = 86_400_000;

/**
 * Confirmation that the replacement targets the same anime cut as the
 * original post. The new object must already sit in the uploader's staging
 * namespace (`videos/_pending/{userId}/…`), same trust model as first
 * uploads. Content matching is human-verified via reports, not automated.
 */
export const replaceVideoSchema = Schema.Struct({
  pendingVideoKey: Schema.String.pipe(
    Schema.check(Schema.isStartsWith("videos/_pending/")),
  ),
  postId: Schema.Number,
});
