import z from "zod";

export const fetchUserInputSchema = z.object({
  page: z.number().min(0).default(0),
  q: z.string().trim().default(""),
  tags: z.array(z.string()).default([]),
  userId: z.string(),
});

export type FetchUserInput = z.infer<typeof fetchUserInputSchema>;
