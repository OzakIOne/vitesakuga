import { Config, ConfigProvider, Effect } from "effect";

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

if (!["development", "production"].includes(raw.MODE)) {
  throw new Error('MODE must be "development" or "production"');
}

export const envClient = raw;
