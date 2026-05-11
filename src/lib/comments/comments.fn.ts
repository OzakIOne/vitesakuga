import { createServerFn } from "@tanstack/react-start";
import { Effect } from "effect";
import { z } from "zod";

import { AuthService, RequestHeadersService } from "../auth/context";
import { KyselyDB } from "../db/context";
import { commentInsertSchema } from "../db/schema";
import { commentSchema } from "./comments.schema";

const importFactories = () => import("../db/layer-factories.server");

export const fetchCommentsEffect = Effect.fn("fetchComments")(function* (
  postId: number,
) {
  const db = yield* KyselyDB;
  yield* Effect.logDebug(`Fetching comments for post ${postId}...`);
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
    catch: (error) => new Error(`Failed to fetch comments: ${String(error)}`),
  });

  yield* Effect.logDebug(`Parsing ${comments.length} comments...`);
  const parsed = yield* Effect.try({
    try: () => z.array(commentSchema).parse(comments),
    catch: (error) => new Error(`Error processing comments: ${String(error)}`),
  });

  yield* Effect.logInfo(
    `Fetched ${parsed.length} comments for post ${postId}.`,
  );
  return parsed;
});

export const addCommentEffect = Effect.fn("addComment")(function* (
  data: z.infer<typeof commentInsertSchema>,
) {
  const db = yield* KyselyDB;
  yield* Effect.logDebug(
    `Adding comment to post ${data.postId} by user ${data.userId}...`,
  );

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

  yield* Effect.logInfo(`Comment ${comment.id} added to post ${data.postId}.`);
  return comment;
});

export const deleteCommentEffect = Effect.fn("deleteComment")(function* (data: {
  commentId: number;
}) {
  const db = yield* KyselyDB;
  const authSvc = yield* AuthService;
  const getHeaders = yield* RequestHeadersService;

  const { commentId } = data;
  yield* Effect.logDebug(`Deleting comment ${commentId}...`);

  const session = yield* Effect.tryPromise({
    try: () =>
      authSvc.api.getSession({
        headers: getHeaders(),
        query: {
          disableCookieCache: true,
        },
      }),
    catch: (error) => new Error(`Failed to get session: ${String(error)}`),
  });

  if (!session?.user) {
    return yield* Effect.fail(
      new Error("Unauthorized: You must be logged in to delete a comment"),
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
    return yield* Effect.fail(new Error(`Comment ${commentId} not found`));
  }

  if (comment.userId !== session.user.id) {
    return yield* Effect.fail(
      new Error("Forbidden: You can only delete your own comments"),
    );
  }

  yield* Effect.logDebug(`Deleting comment ${commentId} from database...`);
  yield* Effect.tryPromise({
    try: () => db.deleteFrom("comments").where("id", "=", commentId).execute(),
    catch: (error) =>
      new Error(`Failed to delete comment ${commentId}: ${String(error)}`),
  });

  yield* Effect.logInfo(`Comment ${commentId} deleted.`);
  return { success: true };
});

// ---- createServerFn wrappers ----

export const fetchComments = createServerFn()
  .inputValidator((input: unknown) => z.number().parse(input))
  .handler(async ({ data: postId }) => {
    const { makeDBLayer } = await importFactories();
    const layer = await makeDBLayer();
    return Effect.runPromise(
      fetchCommentsEffect(postId).pipe(Effect.provide(layer)),
    );
  });

export const addComment = createServerFn()
  .inputValidator((input: unknown) => commentInsertSchema.parse(input))
  .handler(async ({ data }) => {
    const { makeDBLayer } = await importFactories();
    const layer = await makeDBLayer();
    return Effect.runPromise(
      addCommentEffect(data).pipe(Effect.provide(layer)),
    );
  });

export const deleteComment = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) =>
    z
      .object({
        commentId: z.number(),
      })
      .parse(input),
  )
  .handler(async ({ data }) => {
    const { makeAuthLayer } = await importFactories();
    const layer = await makeAuthLayer();
    return Effect.runPromise(
      deleteCommentEffect(data).pipe(Effect.provide(layer)),
    );
  });
