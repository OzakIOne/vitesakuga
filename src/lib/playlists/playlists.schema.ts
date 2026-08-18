import { Effect, Schema, SchemaGetter } from "effect";

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
  playlistId: Schema.Number,
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
  playlistId: Schema.Number,
  postId: Schema.Number,
});

export const removePostFromPlaylistInputSchema = Schema.Struct({
  playlistId: Schema.Number,
  postId: Schema.Number,
});

export const bulkAddPostsToPlaylistInputSchema = Schema.Struct({
  playlistId: Schema.Number,
  postIds: Schema.NonEmptyArray(Schema.Number),
});

export const bulkRemovePostsFromPlaylistInputSchema = Schema.Struct({
  playlistId: Schema.Number,
  postIds: Schema.NonEmptyArray(Schema.Number),
});

export const reorderPlaylistPostsInputSchema = Schema.Struct({
  playlistId: Schema.Number,
  items: Schema.Array(
    Schema.Struct({
      postId: Schema.Number,
      position: Schema.Number,
    }),
  ),
});

export const fetchPlaylistDetailSchema = Schema.Struct({
  playlistId: Schema.Number,
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
