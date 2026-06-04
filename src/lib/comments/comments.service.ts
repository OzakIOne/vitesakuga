import { createServerFn } from "@tanstack/react-start";
import { Context, Effect, Layer, Option } from "effect";
import { z } from "zod";

import { getSessionEffect } from "../auth/auth.middleware";
import { KyselyDB } from "../db/context";
import { makeAuthLayer } from "../db/layer-factories.server";
import { commentInsertSchema } from "../db/schema";
import {
  CommentNotFoundError,
  ForbiddenError,
  UnauthorizedError,
} from "../errors";
import { createHandler } from "../server-fn.handler";
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
      const comments = yield* db.execute(
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
          ]),
      );

      return yield* Effect.try({
        try: () => z.array(commentSchema).parse(comments),
        catch: (error) =>
          new Error(`Error processing comments: ${String(error)}`),
      });
    });

    const add = Effect.fn("CommentsService.add")(function* (
      data: z.infer<typeof commentInsertSchema>,
    ) {
      return yield* db.executeTakeFirstOrError(
        db
          .insertInto("comments")
          .values({
            content: data.content,
            createdAt: new Date(),
            postId: data.postId,
            userId: data.userId,
          })
          .returning(["id", "postId", "content", "userId", "createdAt"]),
      );
    });

    const delete_ = Effect.fn("CommentsService.delete_")(function* (
      commentId: number,
    ) {
      const session = yield* getSessionEffect();

      if (!session?.user) {
        return yield* Effect.fail(
          new UnauthorizedError({
            message: "You must be logged in to delete a comment",
          }),
        );
      }

      const commentOption = yield* db.executeTakeFirstOption(
        db
          .selectFrom("comments")
          .select(["id", "userId"])
          .where("id", "=", commentId),
      );

      if (Option.isNone(commentOption)) {
        return yield* Effect.fail(
          new CommentNotFoundError({
            commentId,
            message: `Comment ${commentId} not found`,
          }),
        );
      }

      const comment = commentOption.value;

      if (comment.userId !== session.user.id) {
        return yield* Effect.fail(
          new ForbiddenError({
            message: "You can only delete your own comments",
          }),
        );
      }

      yield* db.execute(db.deleteFrom("comments").where("id", "=", commentId));

      return { success: true };
    });

    return { fetch, add, delete_ } as unknown as CommentsService["Service"];
  }),
);

export const fetchCommentsEffect = Effect.fn("fetchComments")(function* (
  postId: number,
) {
  const svc = yield* CommentsService;
  return yield* svc.fetch(postId);
});

export const addCommentEffect = Effect.fn("addComment")(function* (
  data: z.infer<typeof commentInsertSchema>,
) {
  const svc = yield* CommentsService;
  return yield* svc.add(data);
});

export const deleteCommentEffect = Effect.fn("deleteComment")(function* (data: {
  commentId: number;
}) {
  const svc = yield* CommentsService;
  return yield* svc.delete_(data.commentId);
});

export const fetchComments = createServerFn()
  .inputValidator((input: unknown) => z.number().parse(input))
  .handler(createHandler(fetchCommentsEffect, CommentsServiceLive));

export const addComment = createServerFn()
  .inputValidator((input: unknown) => commentInsertSchema.parse(input))
  .handler(createHandler(addCommentEffect, CommentsServiceLive));

export const deleteComment = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) =>
    z.object({ commentId: z.number() }).parse(input),
  )
  .handler(
    createHandler(deleteCommentEffect, CommentsServiceLive, makeAuthLayer),
  );
