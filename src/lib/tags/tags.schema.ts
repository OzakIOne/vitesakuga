import { z } from "zod";

export const searchTagsSchema = z.object({
  query: z.string().min(1),
});

export const fetchPostsByTagSchema = z.object({
  tagName: z.string(),
});
