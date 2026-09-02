import { Effect, Schema, SchemaGetter } from "effect";

import {
  MAX_SEARCH_QUERY_LENGTH,
  MAX_SEARCH_TAGS_COUNT,
  MAX_TAG_NAME_LENGTH,
} from "../search/search-limits";

export const userPublicSchema = Schema.Struct({
  id: Schema.String,
  image: Schema.NullOr(Schema.String),
  name: Schema.String,
});

export type UserPublic = Schema.Schema.Type<typeof userPublicSchema>;

/** Row for the comment @mention autocomplete (must carry the handle). */
export const mentionableUserSchema = Schema.Struct({
  id: Schema.String,
  image: Schema.NullOr(Schema.String),
  name: Schema.String,
  username: Schema.String,
});

export type MentionableUser = Schema.Schema.Type<typeof mentionableUserSchema>;

export const mentionSearchInputSchema = Schema.Struct({
  query: Schema.String.pipe(
    Schema.check(
      Schema.isMaxLength(MAX_SEARCH_QUERY_LENGTH, {
        message: `Search query must not exceed ${MAX_SEARCH_QUERY_LENGTH} characters`,
      }),
    ),
    Schema.check(
      Schema.isMinLength(1, {
        message: "Search query must not be empty",
      }),
    ),
  ),
});

export const fetchUserInputSchema = Schema.Struct({
  page: Schema.Number.pipe(
    Schema.check(Schema.isGreaterThanOrEqualTo(0)),
    Schema.withDecodingDefault(Effect.succeed(0)),
  ),
  q: Schema.String.pipe(
    Schema.decode({
      decode: SchemaGetter.transform((val) => val.trim()),
      encode: SchemaGetter.transform((val) => val),
    }),
    Schema.check(
      Schema.isMaxLength(MAX_SEARCH_QUERY_LENGTH, {
        message: `Search query must not exceed ${MAX_SEARCH_QUERY_LENGTH} characters`,
      }),
    ),
    Schema.withDecodingDefault(Effect.succeed("")),
  ),
  tags: Schema.Array(
    Schema.String.pipe(
      Schema.check(
        Schema.isMaxLength(MAX_TAG_NAME_LENGTH, {
          message: `Tag names must not exceed ${MAX_TAG_NAME_LENGTH} characters`,
        }),
      ),
    ),
  ).pipe(
    Schema.check(
      Schema.isMaxLength(MAX_SEARCH_TAGS_COUNT, {
        message: `Select at most ${MAX_SEARCH_TAGS_COUNT} tags`,
      }),
    ),
    Schema.withDecodingDefault(Effect.succeed([])),
  ),
  userId: Schema.String,
});

export type FetchUserInput = Schema.Schema.Type<typeof fetchUserInputSchema>;
