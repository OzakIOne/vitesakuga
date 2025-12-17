// Schema for a comment

import z from "zod";

export const commentSchema = z.object({
  content: z.string(),
  createdAt: z.date(),
  id: z.number(),
  postId: z.coerce.number(),
  userId: z.string(),
  userImage: z.string().nullable(),
  userName: z.string(),
});
