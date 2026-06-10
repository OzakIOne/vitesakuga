import { Config, ConfigProvider, Effect, Schema } from "effect";

const EnvSchema = Schema.Struct({
  BETTER_AUTH_SECRET: Schema.String.pipe(
    Schema.check(
      Schema.isMinLength(32, {
        message: "BETTER_AUTH_SECRET must be at least 32 characters",
      }),
    ),
  ),
  CLOUDFLARE_ACCESS_KEY: Schema.String,
  CLOUDFLARE_BUCKET: Schema.String,
  CLOUDFLARE_R2: Schema.String,
  VITE_CLOUDFLARE_R2_PUBLIC_URL: Schema.String,
  CLOUDFLARE_SECRET_KEY: Schema.String,
  DATABASE_URL: Schema.String,
  GITHUB_CLIENT_ID: Schema.String,
  GITHUB_CLIENT_SECRET: Schema.String,
  NODE_ENV: Schema.Literals(["development", "production"]),
  VITE_BASE_URL: Schema.String,
});

/**
 * - Development: .env (Neon dev + Cloudflare R2 Dev)
 * - Production: .env.production (Neon prod + Cloudflare R2 Prod)
 */
const config = Config.all({
  BETTER_AUTH_SECRET: Config.string("BETTER_AUTH_SECRET"),
  CLOUDFLARE_ACCESS_KEY: Config.string("CLOUDFLARE_ACCESS_KEY"),
  CLOUDFLARE_BUCKET: Config.string("CLOUDFLARE_BUCKET"),
  CLOUDFLARE_R2: Config.string("CLOUDFLARE_R2"),
  VITE_CLOUDFLARE_R2_PUBLIC_URL: Config.string("VITE_CLOUDFLARE_R2_PUBLIC_URL"),
  CLOUDFLARE_SECRET_KEY: Config.string("CLOUDFLARE_SECRET_KEY"),
  DATABASE_URL: Config.string("DATABASE_URL"),
  GITHUB_CLIENT_ID: Config.string("GITHUB_CLIENT_ID"),
  GITHUB_CLIENT_SECRET: Config.string("GITHUB_CLIENT_SECRET"),
  NODE_ENV: Config.string("NODE_ENV"),
  VITE_BASE_URL: Config.string("VITE_BASE_URL"),
});

const provider = ConfigProvider.fromUnknown(process.env);

const raw = Effect.runSync(config.parse(provider));

export const envServer = Schema.decodeUnknownSync(EnvSchema)(raw);
