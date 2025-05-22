import { z } from "zod";

export const userCreateSchema = z.object({
  username: z.string().min(3, "Username must be at least 3 characters"),
  email: z.string().email("Invalid email address"),
});

export type UserCreateInput = z.infer<typeof userCreateSchema>;
