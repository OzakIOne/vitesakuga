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
  // oxlint-disable-next-line anti-slop/no-unknown-parameters -- parseWith is the raw env I/O boundary; it must accept arbitrary provider input.
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
  // oxlint-disable-next-line anti-slop/no-unknown-parameters -- decodeWith is the raw env decoding boundary; it must accept arbitrary unknown values.
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
  GOOGLE_CLIENT_ID: Config.string("GOOGLE_CLIENT_ID"),
  GOOGLE_CLIENT_SECRET: Config.string("GOOGLE_CLIENT_SECRET"),
  NODE_ENV: Config.string("NODE_ENV"),
  TURNSTILE_SECRET: Config.string("TURNSTILE_SECRET").pipe(
    Config.withDefault(""),
  ),
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
      ? secret("GITHUB_CLIENT_SECRET", 1)
      : Schema.RedactedFromValue(Schema.String),
    GOOGLE_CLIENT_ID: requireOAuth
      ? nonEmpty("GOOGLE_CLIENT_ID")
      : Schema.String,
    GOOGLE_CLIENT_SECRET: requireOAuth
      ? secret("GOOGLE_CLIENT_SECRET", 1)
      : Schema.RedactedFromValue(Schema.String),
    NODE_ENV: Schema.Literals(["development", "production", "test"]),
    // Optional in every stage: the captcha plugin is only enabled when the
    // secret is actually configured (see auth/index.ts). Kept as a Redacted
    // secret so it is never logged.
    TURNSTILE_SECRET: Schema.RedactedFromValue(Schema.String),
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
  readonly GITHUB_CLIENT_SECRET: Redacted.Redacted<string>;
  readonly GOOGLE_CLIENT_ID: string;
  readonly GOOGLE_CLIENT_SECRET: Redacted.Redacted<string>;
  readonly NODE_ENV: "development" | "production" | "test";
  readonly TURNSTILE_SECRET: Redacted.Redacted<string>;
  readonly VITE_BASE_URL: string;
};

export const loadServerEnv = (
  source: Readonly<Record<string, string | undefined>> = process.env,
): ServerEnv => {
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
  // Public Google OAuth client ID. Empty unless Google social login has been
  // provisioned; the login/signup Google button only renders when set.
  VITE_GOOGLE_CLIENT_ID: Config.string("VITE_GOOGLE_CLIENT_ID").pipe(
    Config.withDefault(""),
  ),
  VITE_TURNSTILE_SITEKEY: Config.string("VITE_TURNSTILE_SITEKEY").pipe(
    Config.withDefault(""),
  ),
});

const clientEnvSchema = Schema.Struct({
  BASE_URL: Schema.String,
  DEV: Schema.Boolean,
  MODE: Schema.Literals(["development", "production", "test"]),
  PROD: Schema.Boolean,
  SSR: Schema.Boolean,
  VITE_BASE_URL: nonEmpty("VITE_BASE_URL"),
  VITE_CLOUDFLARE_R2_PUBLIC_URL: nonEmpty("VITE_CLOUDFLARE_R2_PUBLIC_URL"),
  VITE_GOOGLE_CLIENT_ID: Schema.String,
  // Empty in environments without Turnstile; render the widget only when set.
  VITE_TURNSTILE_SITEKEY: Schema.String,
});

export const loadClientEnv = (source: ImportMetaEnv = import.meta.env) => {
  const raw = parseWith("client", clientEnvConfig, source);
  return decodeWith("client", clientEnvSchema, raw);
};

// ---- Infrastructure environment ----

const infraEnvSchema = Schema.Struct({
  DATABASE_DRIVER: Schema.optionalKey(Schema.String),
  OTEL_EXPORTER_OTLP_ENDPOINT: Schema.optionalKey(Schema.String),
  SEED_DB: Schema.optionalKey(Schema.String),
});

export type InfraEnv = {
  /**
   * Which database backend the process talks to: `"local"` (developer Docker
   * Postgres), `"e2e"` (Playwright webServer pointing at the same Postgres,
   * plus the auth bypass in session.effect.ts), `"pglite"` (in-memory
   * instance for service tests), or `undefined` (deployed Neon serverless).
   */
  readonly databaseDriver: string | undefined;
  /**
   * OTLP collector endpoint for traces and logs; `undefined` disables the
   * OpenTelemetry layers entirely (a Worker has no reachable default).
   */
  readonly otlpEndpoint: string | undefined;
  /** Opt-in switch for the drizzle-kit seed CLI (`SEED_DB=true`). */
  readonly seedDatabase: boolean;
};

const optionalString = (value: string | undefined): string | undefined =>
  value === undefined || value.length === 0 ? undefined : value;

/**
 * Boot-time infrastructure flags. Unlike the app envs above, these are read
 * before any Effect runtime exists (module-scope driver selection, tracing
 * setup, the drizzle-kit seed CLI), so they are loaded synchronously and
 * interpreted with exact-match comparisons rather than validated further.
 * Kept here so this file remains the single inventory of every environment
 * variable the app reads.
 */
export const loadInfraEnv = (
  source: Readonly<Record<string, string | undefined>> = process.env,
): InfraEnv => {
  const raw = decodeWith("infra", infraEnvSchema, source);
  return {
    databaseDriver: optionalString(raw.DATABASE_DRIVER),
    otlpEndpoint: optionalString(raw.OTEL_EXPORTER_OTLP_ENDPOINT),
    seedDatabase: raw.SEED_DB === "true",
  };
};
