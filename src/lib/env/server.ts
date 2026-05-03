import { z } from "zod";

/**
 * - Development: .env (Neon dev + Cloudflare R2 Dev)
 * - Production: .env.production (Neon prod + Cloudflare R2 Prod)
 */
const schema = z.object({
  BETTER_AUTH_SECRET: z.string().min(32, "Must be at least 32 characters"),
  CLOUDFLARE_ACCESS_KEY: z.string(),
  CLOUDFLARE_BUCKET: z.string(),
  CLOUDFLARE_R2: z.url(),
  CLOUDFLARE_R2_PUBLIC_URL: z.url().optional(),
  CLOUDFLARE_SECRET_KEY: z.string(),
  DATABASE_URL: z.url(),
  GITHUB_CLIENT_ID: z.string(),
  GITHUB_CLIENT_SECRET: z.string(),
  NODE_ENV: z.enum(["development", "production"]),
  // POSTGRES_DB: z.string().optional(),
  // POSTGRES_HOST: z.string().optional(),
  // POSTGRES_PASSWORD: z.string().optional(),
  // POSTGRES_USER: z.string().optional(),
  VITE_BASE_URL: z.url(),
});

// console.log("process.:", process.env);
export const envServer = schema.parse(process.env);
