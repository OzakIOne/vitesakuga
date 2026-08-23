import { Effect, Schema } from "effect";
import { describe, expect, it } from "vitest";

import {
  CommentNotFoundError,
  ForbiddenError,
  PlaylistNotFoundError,
  PostAlreadyInPlaylistError,
  PostNotFoundError,
  RowParseError,
  UnauthorizedError,
  UserNotFoundError,
  ValidationError,
} from "./errors";

describe("tagged errors", () => {
  it("constructs with _tag and fields", () => {
    const err = new PostNotFoundError({ message: "nope", postId: 42 });
    expect(err._tag).toBe("PostNotFoundError");
    expect(err.postId).toBe(42);
    expect(err.message).toBe("nope");
    expect(err instanceof Error).toBe(true);
  });

  it("supports optional cause and literal fields", () => {
    const v = new ValidationError({ message: "bad" });
    expect(v._tag).toBe("ValidationError");
    expect(v.cause).toBeUndefined();

    const withCause = new ValidationError({
      message: "bad",
      cause: new Error("inner"),
    });
    expect(withCause.cause).toBeInstanceOf(Error);
  });

  it("is catchTag-able by tag", async () => {
    const program = Effect.fail(
      new PostNotFoundError({ message: "gone", postId: 7 }),
    ).pipe(
      Effect.catchTag("PostNotFoundError", (err) =>
        Effect.succeed(`caught:${err.postId}`),
      ),
    );
    expect(await Effect.runPromise(program)).toBe("caught:7");
  });

  it("encodes to plain JSON via its schema", () => {
    const err = new CommentNotFoundError({
      message: "gone",
      commentId: 3,
    });
    expect(Schema.encodeSync(CommentNotFoundError)(err)).toEqual({
      _tag: "CommentNotFoundError",
      commentId: 3,
      message: "gone",
    });
  });

  it("covers every domain error tag", () => {
    const errors = [
      new PostNotFoundError({ message: "m", postId: 1 }),
      new UnauthorizedError({ message: "m" }),
      new ForbiddenError({ message: "m" }),
      new CommentNotFoundError({ message: "m", commentId: 1 }),
      new UserNotFoundError({ message: "m", userId: "u" }),
      new ValidationError({ message: "m" }),
      new PlaylistNotFoundError({ message: "m", playlistId: 1 }),
      new PostAlreadyInPlaylistError({
        message: "m",
        playlistId: 1,
        postId: 1,
      }),
      new RowParseError({ message: "m" }),
    ];
    expect(errors.map((e) => e._tag)).toEqual([
      "PostNotFoundError",
      "UnauthorizedError",
      "ForbiddenError",
      "CommentNotFoundError",
      "UserNotFoundError",
      "ValidationError",
      "PlaylistNotFoundError",
      "PostAlreadyInPlaylistError",
      "RowParseError",
    ]);
  });

  it("distinguishes RowParseError from ValidationError by tag", async () => {
    const failure: RowParseError | ValidationError = new RowParseError({
      message: "bad row",
      cause: new Error("schema"),
    });
    const program = Effect.fail(failure).pipe(
      Effect.catchTags(
        { RowParseError: (err) => Effect.succeed(`row:${err.message}`) },
        () => Effect.succeed("other"),
      ),
    );
    expect(await Effect.runPromise(program)).toBe("row:bad row");
  });
});
