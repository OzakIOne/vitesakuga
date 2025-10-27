import { z } from "zod";

export const searchTagsSchema = z.object({
  query: z.string().min(1),
});

export const fetchPostsByTagSchema = z.object({
  tagName: z.string(),
});

export const createTagsForPostSchema = z.object({
  postId: z.number(),
  tags: z.array(
    z.object({
      name: z.string().min(1),
      id: z.number().optional(),
    }),
  ),
});

export const getPostTagsSchema = z.object({
  postId: z.number(),
});
