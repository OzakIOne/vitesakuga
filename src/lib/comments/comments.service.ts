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
import { asPostId, PostId } from "../ids";
import { PointsService, PointsServiceLive } from "../points/points.service";
import { baseLayerFactories, createHandler } from "../server-fn.handler";

export type CommentWithUser = {
  content: string;
  /** ISO timestamp string — `Date` does not survive the JSON server-function transport. */
  createdAt: string;
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
      postId: PostId,
    ) => Effect.Effect<readonly CommentWithUser[], SqlError>;
    readonly add: (
      data: Schema.Schema.Type<typeof commentInsertSchema>,
    ) => Effect.Effect<
      Schema.Codec.Encoded<typeof commentsSelectSchema>,
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
    const points = yield* PointsService;

    const fetch = Effect.fn("CommentsService.fetch")(function* (
      postId: PostId,
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

      return comments.map((row) => ({
        ...row,
        createdAt: row.createdAt.toISOString(),
      }));
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

      // SAFETY: postId is a comments.postId FK column; the row value satisfies
      // the PostId contract by construction.
      const created = {
        ...comment,
        postId: asPostId(comment.postId),
        createdAt: comment.createdAt.toISOString(),
      };

      // Points hook: commenting earns a small daily-capped reward.
      yield* points.awardOrLog({
        userId: user.id,
        action: "comment-written",
        refId: comment.id,
        actorId: user.id,
      });

      yield* Effect.logInfo("Comment added").pipe(
        Effect.annotateLogs({
          commentId: String(comment.id),
          postId: String(data.postId),
          userId: user.id,
        }),
      );

      return created;
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
    postId: PostId,
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
).pipe(Layer.provideMerge(PointsServiceLive));

export const fetchComments = createServerFn({ strict: { output: false } })
  // Scalar server-fn payloads stay unbranded on the wire (TanStack's ServerFnCtx
  // cannot round-trip branded primitives); conversion happens in the handler.
  .validator(parse(Schema.Number))
  .handler(
    createHandler(
      CommentsServiceLive,
      baseLayerFactories.db,
    )((postId: number) => CommentsService.fetch(asPostId(postId))),
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
