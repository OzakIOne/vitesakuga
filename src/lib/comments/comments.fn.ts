import { createServerFn } from "@tanstack/react-start";
import { kysely } from "src/lib/db/kysely";
import { z } from "zod";
import { commentInsertSchema } from "../db/schema";
import { commentSchema } from "./comments.schema";

export const fetchComments = createServerFn()
  .inputValidator((input: unknown) => z.number().parse(input))
  .handler(async ({ data: postId }) => {
    // Fetch comments for the post along with user info
    const comments = await kysely
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
      .execute();

    const parsed = z.array(commentSchema).safeParse(comments);
    if (!parsed.success) {
      throw new Error(`Error fetching comments: ${parsed.error.message}`);
    }

    return parsed.data;
  });

export const addComment = createServerFn()
  .inputValidator((input: unknown) => commentInsertSchema.parse(input))
  .handler(async ({ data }) => {
    const { postId, content, userId } = data;

    return await kysely
      .insertInto("comments")
      .values({
        content,
        createdAt: new Date(),
        postId,
        userId,
      })
      .returning(["id", "postId", "content", "userId", "createdAt"])
      .executeTakeFirstOrThrow();
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
    const { commentId } = data;

    // Get the current user's session
    const { auth: betterAuth } = await import("src/lib/auth");
    const { getRequestHeaders } = await import("@tanstack/react-start/server");

    const session = await betterAuth.api.getSession({
      headers: getRequestHeaders(),
      query: {
        disableCookieCache: true,
      },
    });

    if (!session?.user) {
      throw new Error(
        "Unauthorized: You must be logged in to delete a comment",
      );
    }

    // Verify that the comment belongs to the current user
    const comment = await kysely
      .selectFrom("comments")
      .select(["id", "userId"])
      .where("id", "=", commentId)
      .executeTakeFirst();

    if (!comment) {
      throw new Error(`Comment ${commentId} not found`);
    }

    if (comment.userId !== session.user.id) {
      throw new Error("Forbidden: You can only delete your own comments");
    }

    // Delete the comment
    await kysely.deleteFrom("comments").where("id", "=", commentId).execute();

    return { success: true };
  });
