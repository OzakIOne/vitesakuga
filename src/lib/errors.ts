import { Data } from "effect";

export class PostNotFoundError extends Data.TaggedError("PostNotFoundError")<{
  readonly message: string;
  readonly postId: number;
}> {}

export class UnauthorizedError extends Data.TaggedError("UnauthorizedError")<{
  readonly message: string;
}> {}

export class ForbiddenError extends Data.TaggedError("ForbiddenError")<{
  readonly message: string;
}> {}

export class CommentNotFoundError extends Data.TaggedError(
  "CommentNotFoundError",
)<{
  readonly commentId: number;
  readonly message: string;
}> {}

export class UserNotFoundError extends Data.TaggedError("UserNotFoundError")<{
  readonly message: string;
  readonly userId: string;
}> {}

export class ValidationError extends Data.TaggedError("ValidationError")<{
  readonly message: string;
  readonly cause?: unknown;
}> {}

export class PlaylistNotFoundError extends Data.TaggedError(
  "PlaylistNotFoundError",
)<{
  readonly message: string;
  readonly playlistId: number;
}> {}

export class PostAlreadyInPlaylistError extends Data.TaggedError(
  "PostAlreadyInPlaylistError",
)<{
  readonly message: string;
  readonly playlistId: number;
  readonly postId: number;
}> {}
