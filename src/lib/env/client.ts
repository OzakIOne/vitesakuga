import { Config, ConfigProvider, Effect, Schema } from "effect";

const EnvSchema = Schema.Struct({
  BASE_URL: Schema.String,
  DEV: Schema.Boolean,
  MODE: Schema.Literals(["development", "production", "test"]),
  PROD: Schema.Boolean,
  SSR: Schema.Boolean,
  VITE_BASE_URL: Schema.String,
  VITE_CLOUDFLARE_R2_PUBLIC_URL: Schema.String,
});

const config = Config.all({
  BASE_URL: Config.string("BASE_URL"),
  DEV: Config.boolean("DEV"),
  MODE: Config.string("MODE"),
  PROD: Config.boolean("PROD"),
  SSR: Config.boolean("SSR"),
  VITE_BASE_URL: Config.string("VITE_BASE_URL"),
  VITE_CLOUDFLARE_R2_PUBLIC_URL: Config.string("VITE_CLOUDFLARE_R2_PUBLIC_URL"),
});

const provider = ConfigProvider.fromUnknown(import.meta.env);

const raw = Effect.runSync(config.parse(provider));

export const envClient = Schema.decodeUnknownSync(EnvSchema)(raw);
