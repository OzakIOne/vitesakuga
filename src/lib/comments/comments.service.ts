import { createServerFn } from "@tanstack/react-start";
import { Context, Effect, Layer, Option, Schema } from "effect";

import { getSessionEffect } from "../auth/auth.middleware";
import type { AuthServices } from "../auth/context";
import { KyselyDB } from "../db/context";
import { commentInsertSchema, commentsSelectSchema } from "../db/schema";
import { parse } from "../effect/schema.utils";
import {
  CommentNotFoundError,
  ForbiddenError,
  UnauthorizedError,
} from "../errors";
import { baseLayerFactories, createHandler } from "../server-fn.handler";

export type CommentWithUser = {
  content: string;
  createdAt: Date;
  id: number;
  postId: number;
  userId: string;
  userName: string;
  userImage: string | null;
};

export class CommentsService extends Context.Service<
  CommentsService,
  {
    readonly fetch: (
      postId: number,
    ) => Effect.Effect<readonly CommentWithUser[], Error>;
    readonly add: (
      data: Schema.Schema.Type<typeof commentInsertSchema>,
    ) => Effect.Effect<Schema.Schema.Type<typeof commentsSelectSchema>, Error>;
    readonly delete_: (
      commentId: number,
    ) => Effect.Effect<{ success: boolean }, Error, AuthServices>;
  }
>()("CommentsService", {
  make: Effect.gen(function* () {
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

      return comments;
    });

    const add = Effect.fn("CommentsService.add")(function* (
      data: Schema.Schema.Type<typeof commentInsertSchema>,
    ) {
      const comment = yield* db.executeTakeFirstOrError(
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

      yield* Effect.logInfo("Comment added").pipe(
        Effect.annotateLogs({
          commentId: String(comment.id),
          postId: String(data.postId),
          userId: data.userId,
        }),
      );

      return comment;
    });

    const delete_ = Effect.fn("CommentsService.delete_")(function* (
      commentId: number,
    ) {
      const session = yield* getSessionEffect();

      if (!session?.user) {
        return yield* new UnauthorizedError({
          message: "You must be logged in to delete a comment",
        });
      }

      const commentOption = yield* db.executeTakeFirstOption(
        db
          .selectFrom("comments")
          .select(["id", "userId"])
          .where("id", "=", commentId),
      );

      const comment = yield* Option.match(commentOption, {
        onNone: () =>
          Effect.fail(
            new CommentNotFoundError({
              commentId,
              message: `Comment ${commentId} not found`,
            }),
          ),
        onSome: (value) => Effect.succeed(value),
      });

      if (comment.userId !== session.user.id) {
        return yield* new ForbiddenError({
          message: "You can only delete your own comments",
        });
      }

      yield* db.execute(db.deleteFrom("comments").where("id", "=", commentId));

      yield* Effect.logInfo("Comment deleted").pipe(
        Effect.annotateLogs({
          commentId: String(commentId),
          userId: session.user.id,
        }),
      );

      return { success: true };
    });

    return { fetch, add, delete_ };
  }),
}) {
  static readonly fetch = Effect.fn("CommentsService.fetch")(function* (
    postId: number,
  ) {
    const svc = yield* CommentsService;
    return yield* svc.fetch(postId);
  });

  static readonly add = Effect.fn("CommentsService.add")(function* (
    data: Schema.Schema.Type<typeof commentInsertSchema>,
  ) {
    const svc = yield* CommentsService;
    return yield* svc.add(data);
  });

  static readonly delete_ = Effect.fn("CommentsService.delete_")(function* (
    commentId: number,
  ) {
    const svc = yield* CommentsService;
    return yield* svc.delete_(commentId);
  });
}

export const CommentsServiceLive = Layer.effect(
  CommentsService,
  CommentsService.make,
);

export const fetchComments = createServerFn({ strict: { output: false } })
  .validator((input: unknown) => parse(Schema.Number)(input))
  .handler(createHandler(CommentsService.fetch, CommentsServiceLive));

export const addComment = createServerFn({
  method: "POST",
  strict: { output: false },
})
  .validator((input: unknown) => parse(commentInsertSchema)(input))
  .handler(createHandler(CommentsService.add, CommentsServiceLive));

export const deleteComment = createServerFn({ method: "POST" })
  .validator((input: unknown) =>
    parse(Schema.Struct({ commentId: Schema.Number }))(input),
  )
  .handler(
    createHandler(
      (data: { commentId: number }) => CommentsService.delete_(data.commentId),
      CommentsServiceLive,
      baseLayerFactories.auth,
    ),
  );
