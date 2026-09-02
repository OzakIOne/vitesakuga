import { createServerFn } from "@tanstack/react-start";
import { Context, DateTime, Effect, Layer, Schema } from "effect";

import { ensureOwned } from "../auth/ownership";
import { SessionFetchError, SessionService } from "../auth/session.effect";
import { KyselyDB } from "../db/context";
import {
  commentInsertSchema,
  commentUpdateSchema,
  commentsSelectSchema,
} from "../db/schema";
import { toIsoTimestamp } from "../db/schema/timestamp";
import { SqlError, SqlNoFirstResult } from "../effect/effect.utils";
import { parse } from "../effect/schema.utils";
import {
  CommentNotFoundError,
  ForbiddenError,
  UnauthorizedError,
} from "../errors";
import { asPostId, PostId } from "../ids";
import { extractMentionHandles } from "../mentions/mentions";
import {
  NotificationsService,
  NotificationsServiceLive,
} from "../notifications/notifications.service";
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
  /** @mentions resolved in `content`, for rendering profile links. */
  mentions: readonly { readonly userId: string; readonly username: string }[];
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
    readonly update: (
      data: Schema.Schema.Type<typeof commentUpdateSchema>,
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
    const notifications = yield* NotificationsService;

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

      // Second pass for @mentions: one query for the whole thread, grouped
      // per comment client-side. Deleted users keep their row so old
      // mentions still render (the profile shows "Deleted user").
      const commentIds = comments.map((row) => row.id);
      const mentionRows =
        commentIds.length === 0
          ? []
          : yield* db.execute(
              db
                .selectFrom("comment_mentions")
                .innerJoin("user", "user.id", "comment_mentions.userId")
                .select([
                  "comment_mentions.commentId",
                  "user.id as userId",
                  "user.username",
                ])
                .where("comment_mentions.commentId", "in", commentIds),
            );
      const mentionsByComment = new Map<number, typeof mentionRows>();
      for (const row of mentionRows) {
        const existing = mentionsByComment.get(row.commentId) ?? [];
        existing.push(row);
        mentionsByComment.set(row.commentId, existing);
      }

      return comments.map((row) => ({
        ...row,
        createdAt: toIsoTimestamp(row.createdAt),
        mentions: (mentionsByComment.get(row.id) ?? []).map((mention) => ({
          userId: mention.userId,
          username: mention.username,
        })),
      }));
    });

    /**
     * Resolve `@handle` occurrences in a comment's content into
     * `comment_mentions` rows + notifications. Best-effort: a mention that
     * fails to persist must never fail the comment that carries it.
     * `previousMentionedUserIds` lets edits notify only newly added users.
     */
    const applyMentions = Effect.fn("CommentsService.applyMentions")(
      function* (args: {
        readonly actorId: string;
        readonly commentId: number;
        readonly content: string;
        readonly postId: PostId;
        readonly previousMentionedUserIds: readonly string[];
      }) {
        const handles = extractMentionHandles(args.content);
        if (handles.length === 0) {
          return;
        }

        const mentioned = yield* db.execute(
          db
            .selectFrom("user")
            .select(["id", "username"])
            .where("deletedAt", "is", null)
            .where("username", "in", handles)
            .where("id", "!=", args.actorId),
        );
        if (mentioned.length === 0) {
          return;
        }

        yield* db.execute(
          db
            .insertInto("comment_mentions")
            .values(
              mentioned.map((row) => ({
                commentId: args.commentId,
                userId: row.id,
              })),
            )
            .onConflict((oc) => oc.doNothing()),
        );

        const previouslyMentioned = new Set(args.previousMentionedUserIds);
        for (const row of mentioned) {
          if (previouslyMentioned.has(row.id)) {
            continue;
          }
          yield* notifications.notifyOrLog({
            userId: row.id,
            type: "comment-mention",
            postId: args.postId,
          });
        }
      },
    );

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
        createdAt: toIsoTimestamp(comment.createdAt),
      };

      // Points hook: commenting earns a small daily-capped reward.
      yield* points.awardOrLog({
        userId: user.id,
        action: "comment-written",
        refId: comment.id,
        actorId: user.id,
      });

      // @mention hook: best-effort, never fails the comment.
      yield* applyMentions({
        actorId: user.id,
        commentId: comment.id,
        content: data.content,
        postId: data.postId,
        previousMentionedUserIds: [],
      }).pipe(
        Effect.catchTag("SqlError", (error) =>
          Effect.logError("Failed to apply comment mentions").pipe(
            Effect.annotateLogs({
              commentId: String(comment.id),
              error: String(error),
            }),
          ),
        ),
      );

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

    const update = Effect.fn("CommentsService.update")(function* (
      data: Schema.Schema.Type<typeof commentUpdateSchema>,
    ) {
      const sessions = yield* SessionService;
      const user = yield* sessions.requireUser(
        "You must be logged in to edit a comment",
      );

      const commentOption = yield* db.executeTakeFirstOption(
        db
          .selectFrom("comments")
          .select(["id", "userId", "postId"])
          .where("id", "=", data.commentId),
      );

      const comment = yield* ensureOwned({
        resource: commentOption,
        selectOwnerId: (row) => row.userId,
        userId: user.id,
        notFound: new CommentNotFoundError({
          commentId: data.commentId,
          message: `Comment ${data.commentId} not found`,
        }),
        forbidden: new ForbiddenError({
          message: "You can only edit your own comments",
        }),
      });

      yield* db.execute(
        db
          .updateTable("comments")
          .set({ content: data.content })
          .where("id", "=", data.commentId),
      );

      // Re-resolve @mentions: rows are rebuilt, and only newly mentioned
      // users get a notification. Best-effort, like on creation.
      const previousMentionedUserIds = yield* db.execute(
        db
          .selectFrom("comment_mentions")
          .select("userId")
          .where("commentId", "=", data.commentId),
      );
      yield* db.execute(
        db
          .deleteFrom("comment_mentions")
          .where("commentId", "=", data.commentId),
      );
      yield* applyMentions({
        actorId: user.id,
        commentId: data.commentId,
        content: data.content,
        postId: asPostId(comment.postId),
        previousMentionedUserIds: previousMentionedUserIds.map(
          (row) => row.userId,
        ),
      }).pipe(
        Effect.catchTag("SqlError", (error) =>
          Effect.logError("Failed to apply comment mentions").pipe(
            Effect.annotateLogs({
              commentId: String(data.commentId),
              error: String(error),
            }),
          ),
        ),
      );

      yield* Effect.logInfo("Comment updated").pipe(
        Effect.annotateLogs({
          commentId: String(data.commentId),
          userId: user.id,
        }),
      );

      return { success: true };
    });

    return { fetch, add, delete_, update };
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

  static readonly update = Effect.fn("CommentsService.update")(function* (
    data: Schema.Schema.Type<typeof commentUpdateSchema>,
  ) {
    const svc = yield* CommentsService;
    return yield* svc.update(data);
  });
}

export const CommentsServiceLive = Layer.effect(
  CommentsService,
  CommentsService.make,
).pipe(
  Layer.provideMerge(PointsServiceLive),
  Layer.provideMerge(NotificationsServiceLive),
);

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

export const updateComment = createServerFn({ method: "POST" })
  .validator(parse(commentUpdateSchema))
  .handler(
    createHandler(
      CommentsServiceLive,
      baseLayerFactories.auth,
    )(CommentsService.update),
  );
