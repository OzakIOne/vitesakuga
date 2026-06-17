import { createServerFn } from "@tanstack/react-start";
import { Context, Effect, Layer, Option } from "effect";
import { z } from "zod";

import { getSessionEffect } from "../auth/auth.middleware";
import { KyselyDB } from "../db/context";
import { commentInsertSchema, commentsSelectSchema } from "../db/schema";
import {
  CommentNotFoundError,
  ForbiddenError,
  UnauthorizedError,
} from "../errors";

export class CommentsService extends Context.Service<
  CommentsService,
  {
    readonly fetch: (
      postId: number,
    ) => Effect.Effect<z.infer<typeof commentsSelectSchema>[], Error>;
    readonly add: (
      data: z.infer<typeof commentInsertSchema>,
    ) => Effect.Effect<z.infer<typeof commentsSelectSchema>, Error>;
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
        try: () => z.array(commentsSelectSchema).parse(comments),
        catch: (error) =>
          new Error(`Error processing comments: ${String(error)}`),
      });
    });

    const add = Effect.fn("CommentsService.add")(function* (
      data: z.infer<typeof commentInsertSchema>,
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
        return yield* Effect.fail(
          new ForbiddenError({
            message: "You can only delete your own comments",
          }),
        );
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

export const fetchComments = createServerFn({ strict: { output: false } })
  .validator((input: unknown) => z.number().parse(input))
  .handler(async ({ data }) => {
    const { makeDBLayer } = await import("../db/layer-factories.server");
    const base = await makeDBLayer();
    const layer = CommentsServiceLive.pipe(Layer.provideMerge(base));
    return Effect.runPromise(
      fetchCommentsEffect(data).pipe(
        Effect.provide(layer),
        Effect.tapError((error) =>
          Effect.logError("Server function failed").pipe(
            Effect.annotateLogs({ error: String(error) }),
          ),
        ),
      ),
    );
  });

export const addComment = createServerFn({ method: "POST", strict: { output: false } })
  .validator((input: unknown) => commentInsertSchema.parse(input))
  .handler(async ({ data }) => {
    const { makeDBLayer } = await import("../db/layer-factories.server");
    const base = await makeDBLayer();
    const layer = CommentsServiceLive.pipe(Layer.provideMerge(base));
    return Effect.runPromise(
      addCommentEffect(data).pipe(
        Effect.provide(layer),
        Effect.tapError((error) =>
          Effect.logError("Server function failed").pipe(
            Effect.annotateLogs({ error: String(error) }),
          ),
        ),
      ),
    );
  });

export const deleteComment = createServerFn({ method: "POST" })
  .validator((input: unknown) =>
    z.object({ commentId: z.number() }).parse(input),
  )
  .handler(async ({ data }) => {
    const { makeAuthLayer } = await import("../db/layer-factories.server");
    const base = await makeAuthLayer();
    const layer = CommentsServiceLive.pipe(Layer.provideMerge(base));
    return Effect.runPromise(
      deleteCommentEffect(data).pipe(
        Effect.provide(layer),
        Effect.tapError((error) =>
          Effect.logError("Server function failed").pipe(
            Effect.annotateLogs({ error: String(error) }),
          ),
        ),
      ),
    );
  });
