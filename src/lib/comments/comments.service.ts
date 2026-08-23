import { createServerFn } from "@tanstack/react-start";
import { Context, DateTime, Effect, Layer, Schema } from "effect";

import { ensureOwned } from "../auth/ownership";
import { SessionFetchError, SessionService } from "../auth/session.effect";
import { KyselyDB } from "../db/context";
import { commentInsertSchema, commentsSelectSchema } from "../db/schema";
import { SqlError, SqlNoFirstResult } from "../effect/effect.utils";
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
    ) => Effect.Effect<readonly CommentWithUser[], SqlError>;
    readonly add: (
      data: Schema.Schema.Type<typeof commentInsertSchema>,
    ) => Effect.Effect<
      Schema.Schema.Type<typeof commentsSelectSchema>,
      SqlError | SqlNoFirstResult | UnauthorizedError | SessionFetchError,
      SessionService
    >;
    readonly delete_: (
      commentId: number,
    ) => Effect.Effect<
      { success: boolean },
      | UnauthorizedError
      | ForbiddenError
      | CommentNotFoundError
      | SessionFetchError
      | SqlError,
      SessionService
    >;
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
      const sessions = yield* SessionService;
      const user = yield* sessions.requireUser(
        "You must be logged in to comment",
      );

      const now = yield* DateTime.now;
      const comment = yield* db.executeTakeFirstOrError(
        db
          .insertInto("comments")
          .values({
            content: data.content,
            createdAt: DateTime.toDate(now),
            postId: data.postId,
            userId: user.id,
          })
          .returning(["id", "postId", "content", "userId", "createdAt"]),
      );

      yield* Effect.logInfo("Comment added").pipe(
        Effect.annotateLogs({
          commentId: String(comment.id),
          postId: String(data.postId),
          userId: user.id,
        }),
      );

      return comment;
    });

    const delete_ = Effect.fn("CommentsService.delete_")(function* (
      commentId: number,
    ) {
      const sessions = yield* SessionService;
      const user = yield* sessions.requireUser(
        "You must be logged in to delete a comment",
      );

      const commentOption = yield* db.executeTakeFirstOption(
        db
          .selectFrom("comments")
          .select(["id", "userId"])
          .where("id", "=", commentId),
      );

      yield* ensureOwned({
        resource: commentOption,
        selectOwnerId: (row) => row.userId,
        userId: user.id,
        notFound: new CommentNotFoundError({
          commentId,
          message: `Comment ${commentId} not found`,
        }),
        forbidden: new ForbiddenError({
          message: "You can only delete your own comments",
        }),
      });

      yield* db.execute(db.deleteFrom("comments").where("id", "=", commentId));

      yield* Effect.logInfo("Comment deleted").pipe(
        Effect.annotateLogs({
          commentId: String(commentId),
          userId: user.id,
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
  .validator(parse(Schema.Number))
  .handler(
    createHandler(
      CommentsServiceLive,
      baseLayerFactories.db,
    )(CommentsService.fetch),
  );

export const addComment = createServerFn({
  method: "POST",
  strict: { output: false },
})
  .validator(parse(commentInsertSchema))
  .handler(
    createHandler(
      CommentsServiceLive,
      baseLayerFactories.auth,
    )(CommentsService.add),
  );

export const deleteComment = createServerFn({ method: "POST" })
  .validator(parse(Schema.Struct({ commentId: Schema.Number })))
  .handler(
    createHandler(
      CommentsServiceLive,
      baseLayerFactories.auth,
    )((data: { commentId: number }) => CommentsService.delete_(data.commentId)),
  );
