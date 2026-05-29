import { Context, Effect, Layer } from "effect";
import { z } from "zod";

import { AuthService, RequestHeadersService } from "../auth/context";
import { KyselyDB } from "../db/context";
import { commentInsertSchema } from "../db/schema";
import {
  CommentNotFoundError,
  ForbiddenError,
  UnauthorizedError,
} from "../errors";
import { commentSchema } from "./comments.schema";

export class CommentsService extends Context.Service<
  CommentsService,
  {
    readonly fetch: (postId: number) => Effect.Effect<unknown, Error>;
    readonly add: (
      data: z.infer<typeof commentInsertSchema>,
    ) => Effect.Effect<unknown, Error>;
    readonly delete_: (
      commentId: number,
    ) => Effect.Effect<{ success: boolean }, Error>;
  }
>()("CommentsService") {}

export const CommentsServiceLive = Layer.effect(
  CommentsService,
  Effect.gen(function* () {
    const db = yield* KyselyDB;

    const fetch = Effect.fn("CommentsService.fetch")(function* (
      postId: number,
    ) {
      const comments = yield* Effect.tryPromise({
        try: () =>
          db
            .selectFrom("comments")
            .innerJoin("user", "user.id", "comments.userId")
            .where("comments.postId", "=", postId)
            .orderBy("comments.createdAt", "desc")
            .select([
              "comments.id",
              "comments.content",
              "comments.createdAt",
              "comments.userId",
              "comments.postId",
              "user.name as userName",
              "user.image as userImage",
            ])
            .execute(),
        catch: (error) =>
          new Error(`Failed to fetch comments: ${String(error)}`),
      });

      const parsed = yield* Effect.try({
        try: () => z.array(commentSchema).parse(comments),
        catch: (error) =>
          new Error(`Error processing comments: ${String(error)}`),
      });

      return parsed;
    });

    const add = Effect.fn("CommentsService.add")(function* (
      data: z.infer<typeof commentInsertSchema>,
    ) {
      const comment = yield* Effect.tryPromise({
        try: () =>
          db
            .insertInto("comments")
            .values({
              content: data.content,
              createdAt: new Date(),
              postId: data.postId,
              userId: data.userId,
            })
            .returning(["id", "postId", "content", "userId", "createdAt"])
            .executeTakeFirstOrThrow(),
        catch: (error) => new Error(`Failed to add comment: ${String(error)}`),
      });

      return comment;
    });

    const delete_ = Effect.fn("CommentsService.delete_")(function* (
      commentId: number,
    ) {
      const authSvc = yield* AuthService;
      const getHeaders = yield* RequestHeadersService;

      const session = yield* Effect.tryPromise({
        try: () =>
          authSvc.api.getSession({
            headers: getHeaders(),
            query: { disableCookieCache: true },
          }),
        catch: (error) => new Error(`Failed to get session: ${String(error)}`),
      });

      if (!session?.user) {
        return yield* Effect.fail(
          new UnauthorizedError({
            message: "You must be logged in to delete a comment",
          }),
        );
      }

      const comment = yield* Effect.tryPromise({
        try: () =>
          db
            .selectFrom("comments")
            .select(["id", "userId"])
            .where("id", "=", commentId)
            .executeTakeFirst(),
        catch: (error) =>
          new Error(`Failed to find comment ${commentId}: ${String(error)}`),
      });

      if (!comment) {
        return yield* Effect.fail(
          new CommentNotFoundError({
            commentId,
            message: `Comment ${commentId} not found`,
          }),
        );
      }

      if (comment.userId !== session.user.id) {
        return yield* Effect.fail(
          new ForbiddenError({
            message: "You can only delete your own comments",
          }),
        );
      }

      yield* Effect.tryPromise({
        try: () =>
          db.deleteFrom("comments").where("id", "=", commentId).execute(),
        catch: (error) =>
          new Error(`Failed to delete comment ${commentId}: ${String(error)}`),
      });

      return { success: true };
    });

    return { fetch, add, delete_ };
  }),
);
