import { z } from "zod";

const schema = z.object({
  POSTGRES_HOST: z.string(),
  POSTGRES_DB: z.string(),
  POSTGRES_USER: z.string(),
  POSTGRES_PASSWORD: z.string(),
  VITE_BASE_URL: z.url(),
  DATABASE_URL: z.url(),
  BETTER_AUTH_SECRET: z.string().length(64),
  GITHUB_CLIENT_ID: z.string(),
  GITHUB_CLIENT_SECRET: z.string(),
  CLOUDFLARE_BUCKET: z.string(),
  CLOUDFLARE_R2: z.string(),
  CLOUDFLARE_ACCESS_KEY: z.string(),
  CLOUDFLARE_SECRET_KEY: z.string(),
});

export const envServer = schema.parse(process.env);
