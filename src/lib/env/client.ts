import { z } from "zod";

const schema = z.object({
  BASE_URL: z.string(),
  VITE_BASE_URL: z.url(),
  PROD: z.boolean(),
  DEV: z.boolean(),
  SSR: z.boolean(),
  MODE: z.enum(["development", "production", "test"]),
});

export const envClient = schema.parse(import.meta.env);
