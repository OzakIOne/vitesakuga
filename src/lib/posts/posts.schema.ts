import z from "zod";
import { postsSelectSchema } from "../db/schema";

// Schema for pagination parameters following JSON:API cursor pagination profile
export const fetchPostsInputSchema = z.object({
  page: z
    .object({
      size: z.number().min(1).max(100).default(20), // page[size]
      after: z.number().optional(), // page[after] - cursor for next page
      before: z.number().optional(), // page[before] - cursor for previous page
    })
    .optional()
    .default({ size: 20 }),
});

export const paginatedPostsResponseSchema = z.object({
  data: z.array(postsSelectSchema), // Primary data
  links: z.object({
    self: z.string(),
    next: z.string().nullable(),
  }),
  meta: z.object({
    hasMore: z.boolean(),
    cursors: z.object({
      after: z.number().nullable(),
    }),
  }),
});

export const searchPostsInputSchema = z.object({
  q: z.string().trim().min(1),
  page: z
    .object({
      size: z.number().min(1).max(100).default(20),
      after: z.number().optional(),
    })
    .optional()
    .default({ size: 20 }),
});

export const postIdSchema = z.coerce.number();

export type PaginatedPostsResponse = z.infer<
  typeof paginatedPostsResponseSchema
>;
