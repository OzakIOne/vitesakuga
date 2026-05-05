import { z } from "zod";

export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export const signUpSchema = z
  .object({
    name: z.string().min(3, "You must have a length of at least 3"),
    email: z.string().email(),
    password: z.string().min(8, "You must have a length of at least 8"),
    confirm_password: z.string(),
  })
  .refine((data) => data.password === data.confirm_password, {
    message: "Passwords do not match",
    path: ["confirm_password"],
  });

export const profileSchema = z.object({
  image: z.string().url().or(z.literal("")),
  name: z.string(),
});

export const passwordSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: z.string().min(1),
});
