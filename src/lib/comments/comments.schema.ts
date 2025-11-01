// Schema for a comment

import z from "zod";

// TODO use schema fron drizzle ?
export const commentSchema = z.object({
  id: z.number(),
  postId: z.coerce.number(),
  content: z.string(),
  userId: z.string(),
  createdAt: z.date(),
  userName: z.string(),
  userImage: z.string().nullable(),
});

// TODO knip unused
// export type Comment = z.infer<typeof commentSchema>;

// Schema for creating a comment
// TODO use schema fron drizzle ?
export const createCommentSchema = z.object({
  postId: z.coerce.number(),
  content: z.string().min(1),
  userId: z.string(),
});
