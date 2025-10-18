import { createFileRoute } from "@tanstack/react-router";
import { kysely } from "../../auth/db/kysely";
import { commentsInsertSchema } from "../../auth/db/schema/sakuga.schema";

export const Route = createFileRoute("/api/comments")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const data = await request.json();
        const parsed = commentsInsertSchema.safeParse(data);

        if (!parsed.success) {
          throw new Error(`Invalid comment data: ${parsed.error.message}`);
        }

        const result = await kysely
          .insertInto("comments")
          .values(parsed.data)
          .returning("*")
          .executeTakeFirstOrThrow();

        return result;
      },
      GET: async ({ request }) => {
        const url = new URL(request.url);
        const postId = url.searchParams.get("postId");

        if (!postId) {
          throw new Error("Post ID is required");
        }

        const comments = await kysely
          .selectFrom("comments")
          .innerJoin("user", "user.id", "comments.userId")
          .where("comments.postId", "=", parseInt(postId, 10))
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

        return comments;
      },
    },
  },
});
