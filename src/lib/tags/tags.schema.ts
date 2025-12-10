import { z } from "zod";

export const getPostsByTagSchema = z.object({
  tagName: z.string(),
});
