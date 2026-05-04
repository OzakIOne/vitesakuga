import { Config, ConfigProvider, Effect } from "effect";

/**
 * - Development: .env (Neon dev + Cloudflare R2 Dev)
 * - Production: .env.production (Neon prod + Cloudflare R2 Prod)
 */
const config = Config.all({
  BETTER_AUTH_SECRET: Config.string("BETTER_AUTH_SECRET"),
  CLOUDFLARE_ACCESS_KEY: Config.string("CLOUDFLARE_ACCESS_KEY"),
  CLOUDFLARE_BUCKET: Config.string("CLOUDFLARE_BUCKET"),
  CLOUDFLARE_R2: Config.string("CLOUDFLARE_R2"),
  CLOUDFLARE_R2_PUBLIC_URL: Config.option(
    Config.string("CLOUDFLARE_R2_PUBLIC_URL"),
  ),
  CLOUDFLARE_SECRET_KEY: Config.string("CLOUDFLARE_SECRET_KEY"),
  DATABASE_URL: Config.string("DATABASE_URL"),
  GITHUB_CLIENT_ID: Config.string("GITHUB_CLIENT_ID"),
  GITHUB_CLIENT_SECRET: Config.string("GITHUB_CLIENT_SECRET"),
  NODE_ENV: Config.string("NODE_ENV"),
  VITE_BASE_URL: Config.string("VITE_BASE_URL"),
});

const provider = ConfigProvider.fromUnknown(process.env);

const raw = Effect.runSync(config.parse(provider));

if (raw.BETTER_AUTH_SECRET.length < 32) {
  throw new Error("BETTER_AUTH_SECRET must be at least 32 characters");
}
if (!["development", "production"].includes(raw.NODE_ENV)) {
  throw new Error('NODE_ENV must be "development" or "production"');
}

export const envServer = raw;
