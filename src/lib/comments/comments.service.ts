import { createServerFn } from "@tanstack/react-start";
import { Context, DateTime, Effect, Layer, Schema } from "effect";

import {
  CommunityActivityService,
  CommunityActivityServiceLive,
} from "../activity/community-activity.service";
import { authorizeOwned } from "../auth/policy";
import { SessionFetchError, SessionService } from "../auth/session.effect";
import { KyselyDB } from "../db/context";
import { SqlError, SqlNoFirstResult } from "../db/effect-kysely";
import {
  commentInsertSchema,
  commentUpdateSchema,
  commentsSelectSchema,
} from "../db/schema";
import { toIsoTimestamp } from "../db/schema/timestamp";
import { parse } from "../effect/schema.utils";
import {
  CommentNotFoundError,
  ForbiddenError,
  UnauthorizedError,
} from "../errors";
import { asPostId } from "../ids";
import { createEndpointHandler } from "../server-endpoint";
import { baseLayerFactories } from "../server-fn.handler";

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
      postId: number,
    ) => Effect.Effect<readonly CommentWithUser[], SqlError>;
    readonly add: (
      data: Schema.Schema.Type<typeof commentInsertSchema>,
    ) => Effect.Effect<
      Schema.Codec.Encoded<typeof commentsSelectSchema>,
      | SqlError
      | SqlNoFirstResult
      | ForbiddenError
      | UnauthorizedError
      | SessionFetchError,
      SessionService
    >;
    readonly delete_: (input: {
      commentId: number;
    }) => Effect.Effect<
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
    const community = yield* CommunityActivityService;

    const fetch = Effect.fn("CommentsService.fetch")(function* (
      rawPostId: number,
    ) {
      const postId = asPostId(rawPostId);
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

      // Resolve current handles only for active users. Deleted users fall
      // back to the handle captured in the stored mention token.
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
                .where("comment_mentions.commentId", "in", commentIds)
                .where("user.deletedAt", "is", null),
            );
      const mentionsByComment = new Map<number, typeof mentionRows>();
      for (const row of mentionRows) {
        const existing = mentionsByComment.get(row.commentId) ?? [];
        existing.push(row);
        mentionsByComment.set(row.commentId, existing);
      }

      return comments.map((row) => ({
        ...row,
        // SAFETY: comments.postId is a bigint column and node-postgres
        // returns int8 as a string; the value is the row's FK to posts.id,
        // so Number() is exact and the client needs a real number for
        // react-query cache keys.
        postId: asPostId(Number(row.postId)),
        createdAt: toIsoTimestamp(row.createdAt),
        mentions: (mentionsByComment.get(row.id) ?? []).map((mention) => ({
          userId: mention.userId,
          username: mention.username,
        })),
      }));
    });

    const add = Effect.fn("CommentsService.add")(function* (
      data: Schema.Schema.Type<typeof commentInsertSchema>,
    ) {
      const sessions = yield* SessionService;
      const user = yield* sessions.requireActor(
        "You must be logged in to comment",
      );

      const canonical = yield* community.canonicalizeCommentMentions({
        authorId: user.id,
        content: data.content,
      });

      const now = yield* DateTime.now;
      const comment = yield* db.transaction((trx) =>
        Effect.gen(function* () {
          const inserted = yield* trx.executeTakeFirstOrError(
            trx
              .insertInto("comments")
              .values({
                content: canonical.content,
                createdAt: DateTime.toDate(now),
                postId: data.postId,
                userId: user.id,
              })
              .returning(["id", "postId", "content", "userId", "createdAt"]),
          );
          yield* community.recordInTransaction(trx, {
            _tag: "CommentWritten",
            authorId: user.id,
            commentId: inserted.id,
            mentionedUserIds: canonical.mentionUserIds,
            postId: data.postId,
          });
          return inserted;
        }),
      );

      // SAFETY: postId is a comments.postId FK column; the row value satisfies
      // the PostId contract by construction. Number() undoes the string
      // coercion node-postgres applies to bigint columns.
      const created = {
        ...comment,
        postId: asPostId(Number(comment.postId)),
        createdAt: toIsoTimestamp(comment.createdAt),
      };

      yield* Effect.logInfo("Comment added").pipe(
        Effect.annotateLogs({
          commentId: String(comment.id),
          postId: String(data.postId),
          userId: user.id,
        }),
      );

      return created;
    });

    const delete_ = Effect.fn("CommentsService.delete_")(function* ({
      commentId,
    }: {
      commentId: number;
    }) {
      const sessions = yield* SessionService;
      const user = yield* sessions.requireActor(
        "You must be logged in to delete a comment",
      );

      const commentOption = yield* db.executeTakeFirstOption(
        db
          .selectFrom("comments")
          .select(["id", "userId"])
          .where("id", "=", commentId),
      );

      yield* authorizeOwned({
        actor: user,
        resource: commentOption,
        selectOwnerId: (row) => row.userId,
        own: "comments:delete-own",
        any: "comments:delete-any",
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
      const user = yield* sessions.requireActor(
        "You must be logged in to edit a comment",
      );

      const commentOption = yield* db.executeTakeFirstOption(
        db
          .selectFrom("comments")
          .select(["id", "userId", "postId"])
          .where("id", "=", data.commentId),
      );

      const comment = yield* authorizeOwned({
        actor: user,
        resource: commentOption,
        selectOwnerId: (row) => row.userId,
        own: "comments:edit-own",
        any: "comments:edit-any",
        notFound: new CommentNotFoundError({
          commentId: data.commentId,
          message: `Comment ${data.commentId} not found`,
        }),
        forbidden: new ForbiddenError({
          message: "You can only edit your own comments",
        }),
      });

      // The editor sends de-tokenized text, so mentions are re-resolved here.
      const canonical = yield* community.canonicalizeCommentMentions({
        authorId: user.id,
        content: data.content,
      });

      yield* db.transaction((trx) =>
        Effect.gen(function* () {
          yield* trx.execute(
            trx
              .updateTable("comments")
              .set({ content: canonical.content })
              .where("id", "=", data.commentId),
          );
          yield* community.recordInTransaction(trx, {
            _tag: "CommentEdited",
            commentId: data.commentId,
            mentionedUserIds: canonical.mentionUserIds,
            postId: comment.postId,
          });
        }),
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
}) {}

export const CommentsServiceLive = Layer.effect(
  CommentsService,
  CommentsService.make,
).pipe(Layer.provideMerge(CommunityActivityServiceLive));

export const fetchComments = createServerFn({ strict: { output: false } })
  // Scalar server-fn payloads stay unbranded on the wire (TanStack's ServerFnCtx
  // cannot round-trip branded primitives); the service brands the id on entry.
  .validator(parse(Schema.Number))
  .handler(
    createEndpointHandler({
      service: CommentsService,
      operation: "fetch",
      layer: CommentsServiceLive,
      base: baseLayerFactories.db,
    }),
  );

export const addComment = createServerFn({
  method: "POST",
  strict: { output: false },
})
  .validator(parse(commentInsertSchema))
  .handler(
    createEndpointHandler({
      service: CommentsService,
      operation: "add",
      layer: CommentsServiceLive,
      base: baseLayerFactories.auth,
    }),
  );

export const deleteComment = createServerFn({ method: "POST" })
  .validator(parse(Schema.Struct({ commentId: Schema.Number })))
  .handler(
    createEndpointHandler({
      service: CommentsService,
      operation: "delete_",
      layer: CommentsServiceLive,
      base: baseLayerFactories.auth,
    }),
  );

export const updateComment = createServerFn({ method: "POST" })
  .validator(parse(commentUpdateSchema))
  .handler(
    createEndpointHandler({
      service: CommentsService,
      operation: "update",
      layer: CommentsServiceLive,
      base: baseLayerFactories.auth,
    }),
  );
