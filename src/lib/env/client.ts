import { z } from "zod";

const schema = z.object({
  BASE_URL: z.string(),
  VITE_BASE_URL: z.url(),
  PROD: z.enum(["true", "false"]),
  DEV: z.enum(["true", "false"]),
  MODE: z.enum(["development", "production", "test"]),
  SSR: z.enum(["true", "false"]),
});

export const envClient = schema.parse(import.meta.env);
