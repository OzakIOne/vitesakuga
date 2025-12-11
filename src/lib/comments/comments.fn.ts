import { createServerFn } from "@tanstack/react-start";
import { kysely } from "src/lib/db/kysely";
import { z } from "zod";
import { commentInsertSchema } from "../db/schema";
import { commentSchema } from "./comments.schema";

export const fetchComments = createServerFn()
  .inputValidator((input: unknown) => z.number().parse(input))
  .handler(async (ctx) => {
    const postId = ctx.data;

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
  .handler(async (ctx) => {
    const { postId, content, userId } = ctx.data;

    return await kysely
      .insertInto("comments")
      .values({
        postId,
        content,
        userId,
        createdAt: new Date(),
      })
      .returning(["id", "postId", "content", "userId", "createdAt"])
      .executeTakeFirstOrThrow();
  });
