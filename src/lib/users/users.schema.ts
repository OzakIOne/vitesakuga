import z from "zod";

export const fetchUserInputSchema = z.object({
  page: z
    .object({
      after: z.number().optional(),
      size: z.number().min(1).max(100).default(20),
    })
    .optional()
    .default({ size: 20 }),
  q: z.string().trim().default(""),
  tags: z.array(z.string()).default([]),
  userId: z.string(),
});
