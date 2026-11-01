import { Schema } from "effect";

import { clientSafeAnnotations } from "./client-safe-error";

export class PostNotFoundError extends Schema.TaggedError<PostNotFoundError>()(
  "PostNotFoundError",
  {
    message: Schema.String,
    postId: Schema.Number,
  },
  clientSafeAnnotations,
) {}

export class UnauthorizedError extends Schema.TaggedError<UnauthorizedError>()(
  "UnauthorizedError",
  {
    message: Schema.String,
  },
  clientSafeAnnotations,
) {}

export class ForbiddenError extends Schema.TaggedError<ForbiddenError>()(
  "ForbiddenError",
  {
    message: Schema.String,
  },
  clientSafeAnnotations,
) {}

export class CommentNotFoundError extends Schema.TaggedError<CommentNotFoundError>()(
  "CommentNotFoundError",
  {
    commentId: Schema.Number,
    message: Schema.String,
  },
  clientSafeAnnotations,
) {}

export class UserNotFoundError extends Schema.TaggedError<UserNotFoundError>()(
  "UserNotFoundError",
  {
    message: Schema.String,
    userId: Schema.String,
  },
  clientSafeAnnotations,
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
  clientSafeAnnotations,
) {}

export class PostAlreadyInPlaylistError extends Schema.TaggedError<PostAlreadyInPlaylistError>()(
  "PostAlreadyInPlaylistError",
  {
    message: Schema.String,
    playlistId: Schema.Number,
    postId: Schema.Number,
  },
  clientSafeAnnotations,
) {}

// Promotion review: the candidate was already moved out of "novice" by a
// concurrent/previous decision, so approving/rejecting again would double-write.
export class PromotionAlreadyReviewedError extends Schema.TaggedError<PromotionAlreadyReviewedError>()(
  "PromotionAlreadyReviewedError",
  {
    message: Schema.String,
  },
  clientSafeAnnotations,
) {}

// Promotion review: the candidate no longer (or never did) meet the
// eligibility rules (points threshold / account age / rank).
export class PromotionNotEligibleError extends Schema.TaggedError<PromotionNotEligibleError>()(
  "PromotionNotEligibleError",
  {
    message: Schema.String,
  },
  clientSafeAnnotations,
) {}

// Edit suggestion: the referenced suggestion does not exist.
export class EditNotFoundError extends Schema.TaggedError<EditNotFoundError>()(
  "EditNotFoundError",
  {
    editId: Schema.Number,
    message: Schema.String,
  },
  clientSafeAnnotations,
) {}

// Edit suggestion: a decision (approval/rejection) was already applied, so
// voting again would mutate settled history.
export class EditAlreadyResolvedError extends Schema.TaggedError<EditAlreadyResolvedError>()(
  "EditAlreadyResolvedError",
  {
    editId: Schema.Number,
    message: Schema.String,
  },
  clientSafeAnnotations,
) {}
