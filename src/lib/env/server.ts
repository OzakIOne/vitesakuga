import { z } from "zod";

const schema = z.object({
  BETTER_AUTH_SECRET: z.string().length(64),
  CLOUDFLARE_ACCESS_KEY: z.string(),
  CLOUDFLARE_BUCKET: z.string(),
  CLOUDFLARE_R2: z.string(),
  CLOUDFLARE_SECRET_KEY: z.string(),
  DATABASE_URL: z.url(),
  GITHUB_CLIENT_ID: z.string(),
  GITHUB_CLIENT_SECRET: z.string(),
  NODE_ENV: z
    .enum(["development", "production", "test"])
    .default("development"),
  POSTGRES_DB: z.string(),
  POSTGRES_HOST: z.string(),
  POSTGRES_PASSWORD: z.string(),
  POSTGRES_USER: z.string(),
  VITE_BASE_URL: z.url(),
});

export const envServer = schema.parse(process.env);
