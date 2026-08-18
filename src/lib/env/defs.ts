import { Config, ConfigProvider, Effect, Redacted, Schema } from "effect";

/**
 * Shared environment schemas and loaders, without any module-level side
 * effects. App entry points (`env/server.ts`, `env/client.ts`) and the
 * drizzle CLI all validate against the same definitions, so a stage never
 * bypasses the schema.
 */

const nonEmpty = (name: string) =>
  Schema.String.pipe(
    Schema.check(
      Schema.isMinLength(1, {
        message: `${name} must not be empty`,
      }),
    ),
  );

const secret = (name: string, minLength: number) =>
  Schema.RedactedFromValue(
    Schema.String.pipe(
      Schema.check(
        Schema.isMinLength(minLength, {
          message:
            minLength === 1
              ? `${name} must not be empty`
              : `${name} must be at least ${minLength} characters`,
        }),
      ),
    ),
  );

const parseWith = <A>(
  label: string,
  config: Config.Config<A>,
  source: unknown,
): A => {
  try {
    return Effect.runSync(config.parse(ConfigProvider.fromUnknown(source)));
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    throw new Error(`Invalid ${label} environment.\n${detail}`);
  }
};

const decodeWith = <S extends Schema.ConstraintDecoder<unknown>>(
  label: string,
  schema: S,
  value: unknown,
): S["Type"] => {
  try {
    return Schema.decodeUnknownSync(schema)(value);
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    throw new Error(`Invalid ${label} environment.\n${detail}`);
  }
};

// ---- Server environment ----

const serverEnvConfig = Config.all({
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

const serverEnvSchema = (requireOAuth: boolean) =>
  Schema.Struct({
    BETTER_AUTH_SECRET: secret("BETTER_AUTH_SECRET", 32),
    CLOUDFLARE_ACCESS_KEY: secret("CLOUDFLARE_ACCESS_KEY", 1),
    CLOUDFLARE_BUCKET: nonEmpty("CLOUDFLARE_BUCKET"),
    CLOUDFLARE_R2: nonEmpty("CLOUDFLARE_R2"),
    VITE_CLOUDFLARE_R2_PUBLIC_URL: nonEmpty("VITE_CLOUDFLARE_R2_PUBLIC_URL"),
    CLOUDFLARE_SECRET_KEY: secret("CLOUDFLARE_SECRET_KEY", 1),
    DATABASE_URL: nonEmpty("DATABASE_URL"),
    GITHUB_CLIENT_ID: requireOAuth
      ? nonEmpty("GITHUB_CLIENT_ID")
      : Schema.String,
    GITHUB_CLIENT_SECRET: requireOAuth
      ? nonEmpty("GITHUB_CLIENT_SECRET")
      : Schema.String,
    NODE_ENV: Schema.Literals(["development", "production", "test"]),
    VITE_BASE_URL: nonEmpty("VITE_BASE_URL"),
  });

export type ServerEnv = {
  readonly BETTER_AUTH_SECRET: Redacted.Redacted<string>;
  readonly CLOUDFLARE_ACCESS_KEY: Redacted.Redacted<string>;
  readonly CLOUDFLARE_BUCKET: string;
  readonly CLOUDFLARE_R2: string;
  readonly VITE_CLOUDFLARE_R2_PUBLIC_URL: string;
  readonly CLOUDFLARE_SECRET_KEY: Redacted.Redacted<string>;
  readonly DATABASE_URL: string;
  readonly GITHUB_CLIENT_ID: string;
  readonly GITHUB_CLIENT_SECRET: string;
  readonly NODE_ENV: "development" | "production" | "test";
  readonly VITE_BASE_URL: string;
};

export const loadServerEnv = (source: unknown = process.env): ServerEnv => {
  const raw = parseWith("server", serverEnvConfig, source);
  // OAuth credentials are required in production, optional (may be empty) in
  // development/test where local and e2e configs do not set them.
  const schema = serverEnvSchema(raw.NODE_ENV === "production");
  return decodeWith("server", schema, raw);
};

// ---- Client environment ----

const clientEnvConfig = Config.all({
  BASE_URL: Config.string("BASE_URL"),
  DEV: Config.boolean("DEV"),
  MODE: Config.string("MODE"),
  PROD: Config.boolean("PROD"),
  SSR: Config.boolean("SSR"),
  VITE_BASE_URL: Config.string("VITE_BASE_URL"),
  VITE_CLOUDFLARE_R2_PUBLIC_URL: Config.string("VITE_CLOUDFLARE_R2_PUBLIC_URL"),
});

const clientEnvSchema = Schema.Struct({
  BASE_URL: Schema.String,
  DEV: Schema.Boolean,
  MODE: Schema.Literals(["development", "production", "test"]),
  PROD: Schema.Boolean,
  SSR: Schema.Boolean,
  VITE_BASE_URL: nonEmpty("VITE_BASE_URL"),
  VITE_CLOUDFLARE_R2_PUBLIC_URL: nonEmpty("VITE_CLOUDFLARE_R2_PUBLIC_URL"),
});

export const loadClientEnv = (source: unknown = import.meta.env) => {
  const raw = parseWith("client", clientEnvConfig, source);
  return decodeWith("client", clientEnvSchema, raw);
};
