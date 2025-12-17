import { z } from "zod";

const schema = z.object({
  BASE_URL: z.string(),
  DEV: z.boolean(),
  MODE: z.enum(["development", "production", "test"]),
  PROD: z.boolean(),
  SSR: z.boolean(),
  VITE_BASE_URL: z.url(),
});

export const envClient = schema.parse(import.meta.env);
