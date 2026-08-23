import { Schema } from "effect";

/**
 * Branded entity identifiers for the two entities whose IDs most often cross
 * paths in the same call (playlists ↔ posts). Compile-time only: a branded ID
 * *is* its primitive at runtime, so serialization, Kysely and Postgres are
 * unaffected. Plain primitives widen INTO brands freely; the reverse requires
 * going through a schema (or the explicit `as*` coercions below), which is
 * what makes swapped-ID arguments a compile error instead of silent damage.
 */

export const PostId = Schema.Number.pipe(Schema.brand("@App/PostId"));
export type PostId = Schema.Schema.Type<typeof PostId>;

export const PlaylistId = Schema.Number.pipe(Schema.brand("@App/PlaylistId"));
export type PlaylistId = Schema.Schema.Type<typeof PlaylistId>;

/**
 * Coerce an unvalidated number into a branded ID. Escape hatch for the two
 * places values cannot flow through a schema: test fixtures and values read
 * straight off database rows whose primary-key/FK columns guarantee validity
 * (annotate those sites with SAFETY comments), plus route-param conversions
 * at loader boundaries — server-function validators re-validate every input,
 * so the coercion only satisfies the compiler, never real trust.
 */
export const asPostId = (value: number): PostId => {
  // SAFETY: this helper is the sanctioned coercion point; callers attest the
  // value originates from a PK/FK column or gets re-validated server-side.
  return value as PostId;
};

export const asPlaylistId = (value: number): PlaylistId => {
  // SAFETY: see asPostId.
  return value as PlaylistId;
};
