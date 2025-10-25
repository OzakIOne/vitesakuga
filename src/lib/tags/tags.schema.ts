import z from "zod";

export const searchTagsSchema = z.object({
  query: z.string().min(1),
});
