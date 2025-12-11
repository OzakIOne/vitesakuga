// Schema for a comment

import z from "zod";

export const commentSchema = z.object({
  id: z.number(),
  postId: z.coerce.number(),
  content: z.string(),
  userId: z.string(),
  createdAt: z.date(),
  userName: z.string(),
  userImage: z.string().nullable(),
});
