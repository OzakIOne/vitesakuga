import { Effect, Schema, SchemaGetter } from "effect";

import { PlaylistId, PostId } from "../ids";
import { sanitize } from "../sanitize";

const sanitizeString = <S extends Schema.Schema<string>>(schema: S) =>
  schema.pipe(
    Schema.decodeTo(Schema.String, {
      decode: SchemaGetter.transform((val) => sanitize(val)),
      encode: SchemaGetter.transform((val) => val),
    }),
  );

export const createPlaylistInputSchema = Schema.Struct({
  title: sanitizeString(
    Schema.String.pipe(
      Schema.check(Schema.isMinLength(1, { message: "Title is required" })),
      Schema.check(Schema.isMaxLength(200)),
    ),
  ),
  description: Schema.optionalKey(
    sanitizeString(Schema.String.pipe(Schema.check(Schema.isMaxLength(1000)))),
  ),
  isPublic: Schema.optionalKey(
    Schema.Boolean.pipe(Schema.withDecodingDefault(Effect.succeed(false))),
  ),
});

export const updatePlaylistInputSchema = Schema.Struct({
  playlistId: PlaylistId,
  title: Schema.optionalKey(
    sanitizeString(
      Schema.String.pipe(
        Schema.check(Schema.isMinLength(1)),
        Schema.check(Schema.isMaxLength(200)),
      ),
    ),
  ),
  description: Schema.optionalKey(
    sanitizeString(Schema.String.pipe(Schema.check(Schema.isMaxLength(1000)))),
  ),
  isPublic: Schema.optionalKey(Schema.Boolean),
});

export const addPostToPlaylistInputSchema = Schema.Struct({
  playlistId: PlaylistId,
  postId: PostId,
});

export const removePostFromPlaylistInputSchema = Schema.Struct({
  playlistId: PlaylistId,
  postId: PostId,
});

export const bulkAddPostsToPlaylistInputSchema = Schema.Struct({
  playlistId: PlaylistId,
  postIds: Schema.NonEmptyArray(PostId),
});

export const bulkRemovePostsFromPlaylistInputSchema = Schema.Struct({
  playlistId: PlaylistId,
  postIds: Schema.NonEmptyArray(PostId),
});

export const reorderPlaylistPostsInputSchema = Schema.Struct({
  playlistId: PlaylistId,
  items: Schema.Array(
    Schema.Struct({
      postId: PostId,
      position: Schema.Number,
    }),
  ),
});

export const fetchPlaylistDetailSchema = Schema.Struct({
  playlistId: PlaylistId,
  page: Schema.Number.pipe(
    Schema.check(Schema.isGreaterThanOrEqualTo(0)),
    Schema.withDecodingDefault(Effect.succeed(0)),
  ),
});

export const fetchPublicPlaylistsSchema = Schema.Struct({
  page: Schema.Number.pipe(
    Schema.check(Schema.isGreaterThanOrEqualTo(0)),
    Schema.withDecodingDefault(Effect.succeed(0)),
  ),
});
