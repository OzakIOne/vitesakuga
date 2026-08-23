import { Schema } from "effect";

export class PostNotFoundError extends Schema.TaggedError<PostNotFoundError>()(
  "PostNotFoundError",
  {
    message: Schema.String,
    postId: Schema.Number,
  },
) {}

export class UnauthorizedError extends Schema.TaggedError<UnauthorizedError>()(
  "UnauthorizedError",
  {
    message: Schema.String,
  },
) {}

export class ForbiddenError extends Schema.TaggedError<ForbiddenError>()(
  "ForbiddenError",
  {
    message: Schema.String,
  },
) {}

export class CommentNotFoundError extends Schema.TaggedError<CommentNotFoundError>()(
  "CommentNotFoundError",
  {
    commentId: Schema.Number,
    message: Schema.String,
  },
) {}

export class UserNotFoundError extends Schema.TaggedError<UserNotFoundError>()(
  "UserNotFoundError",
  {
    message: Schema.String,
    userId: Schema.String,
  },
) {}

export class ValidationError extends Schema.TaggedError<ValidationError>()(
  "ValidationError",
  {
    message: Schema.String,
    cause: Schema.optionalKey(Schema.Unknown),
  },
) {}

// A database row failed to decode against its domain schema. This is an
// internal data-integrity defect, not bad user input — never render it as a
// validation message in the UI.
export class RowParseError extends Schema.TaggedError<RowParseError>()(
  "RowParseError",
  {
    message: Schema.String,
    cause: Schema.optionalKey(Schema.Unknown),
  },
) {}

export class PlaylistNotFoundError extends Schema.TaggedError<PlaylistNotFoundError>()(
  "PlaylistNotFoundError",
  {
    message: Schema.String,
    playlistId: Schema.Number,
  },
) {}

export class PostAlreadyInPlaylistError extends Schema.TaggedError<PostAlreadyInPlaylistError>()(
  "PostAlreadyInPlaylistError",
  {
    message: Schema.String,
    playlistId: Schema.Number,
    postId: Schema.Number,
  },
) {}
