import { createServerFn } from "@tanstack/react-start";
import { Effect } from "effect";
import { kysely } from "src/lib/db/kysely";
import { z } from "zod";

import { commentInsertSchema } from "../db/schema";
import { Debug, withMinimumLogLevel } from "../effect/logger";
import { commentSchema } from "./comments.schema";

export const fetchComments = createServerFn()
  .inputValidator((input: unknown) => z.number().parse(input))
  .handler(({ data: postId }) =>
    Effect.runPromise(
      Effect.fn("fetchComments")(
        function* () {
          yield* Effect.logDebug(`Fetching comments for post ${postId}...`);
          const comments = yield* Effect.tryPromise({
            try: () =>
              kysely
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

          yield* Effect.logDebug(`Parsing ${comments.length} comments...`);
          const parsed = yield* Effect.try({
            try: () => z.array(commentSchema).parse(comments),
            catch: (error) =>
              new Error(`Error processing comments: ${String(error)}`),
          });

          yield* Effect.logInfo(
            `Fetched ${parsed.length} comments for post ${postId}.`,
          );
          return parsed;
        },
        Effect.provide(withMinimumLogLevel(Debug)),
      )(),
    ),
  );

export const addComment = createServerFn()
  .inputValidator((input: unknown) => commentInsertSchema.parse(input))
  .handler(({ data }) =>
    Effect.runPromise(
      Effect.fn("addComment")(
        function* () {
          yield* Effect.logDebug(
            `Adding comment to post ${data.postId} by user ${data.userId}...`,
          );

          const comment = yield* Effect.tryPromise({
            try: () =>
              kysely
                .insertInto("comments")
                .values({
                  content: data.content,
                  createdAt: new Date(),
                  postId: data.postId,
                  userId: data.userId,
                })
                .returning(["id", "postId", "content", "userId", "createdAt"])
                .executeTakeFirstOrThrow(),
            catch: (error) =>
              new Error(`Failed to add comment: ${String(error)}`),
          });

          yield* Effect.logInfo(
            `Comment ${comment.id} added to post ${data.postId}.`,
          );
          return comment;
        },
        Effect.provide(withMinimumLogLevel(Debug)),
      )(),
    ),
  );

export const deleteComment = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) =>
    z
      .object({
        commentId: z.number(),
      })
      .parse(input),
  )
  .handler(({ data }) =>
    Effect.runPromise(
      Effect.fn("deleteComment")(
        function* () {
          const { commentId } = data;
          yield* Effect.logDebug(`Deleting comment ${commentId}...`);

          const session = yield* Effect.tryPromise({
            try: async () => {
              const { auth: betterAuth } = await import("src/lib/auth");
              const { getRequestHeaders } =
                await import("@tanstack/react-start/server");

              return betterAuth.api.getSession({
                headers: getRequestHeaders(),
                query: {
                  disableCookieCache: true,
                },
              });
            },
            catch: (error) =>
              new Error(`Failed to get session: ${String(error)}`),
          });

          if (!session?.user) {
            return yield* Effect.fail(
              new Error(
                "Unauthorized: You must be logged in to delete a comment",
              ),
            );
          }

          const comment = yield* Effect.tryPromise({
            try: () =>
              kysely
                .selectFrom("comments")
                .select(["id", "userId"])
                .where("id", "=", commentId)
                .executeTakeFirst(),
            catch: (error) =>
              new Error(
                `Failed to find comment ${commentId}: ${String(error)}`,
              ),
          });

          if (!comment) {
            return yield* Effect.fail(
              new Error(`Comment ${commentId} not found`),
            );
          }

          if (comment.userId !== session.user.id) {
            return yield* Effect.fail(
              new Error("Forbidden: You can only delete your own comments"),
            );
          }

          yield* Effect.logDebug(
            `Deleting comment ${commentId} from database...`,
          );
          yield* Effect.tryPromise({
            try: () =>
              kysely
                .deleteFrom("comments")
                .where("id", "=", commentId)
                .execute(),
            catch: (error) =>
              new Error(
                `Failed to delete comment ${commentId}: ${String(error)}`,
              ),
          });

          yield* Effect.logInfo(`Comment ${commentId} deleted.`);
          return { success: true };
        },
        Effect.provide(withMinimumLogLevel(Debug)),
      )(),
    ),
  );
