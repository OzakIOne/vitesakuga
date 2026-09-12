import { describe, expect, it } from "vitest";

import { loadClientEnv, loadInfraEnv } from "./defs";

const makeClientEnv = (
  overrides: Partial<Parameters<typeof loadClientEnv>[0]> = {},
) => ({
  BASE_URL: "http://localhost:3000/",
  DEV: false,
  MODE: "production",
  PROD: true,
  SSR: false,
  VITE_BASE_URL: "https://copied.example",
  VITE_CLOUDFLARE_R2_PUBLIC_URL: "https://copied.example/media",
  VITE_GOOGLE_CLIENT_ID: "",
  VITE_TURNSTILE_REQUIRED: "0",
  VITE_TURNSTILE_SITEKEY: "",
  ...overrides,
});

describe(loadInfraEnv, () => {
  it("reads all flags from an explicit source", () => {
    const env = loadInfraEnv({
      DATABASE_DRIVER: "local",
      OTEL_EXPORTER_OTLP_ENDPOINT: "http://collector:4318",
      SEED_DB: "true",
    });
    expect(env).toEqual({
      databaseDriver: "local",
      otlpEndpoint: "http://collector:4318",
      seedDatabase: true,
    });
  });

  it("normalizes empty strings to undefined", () => {
    // tracing.ts previously relied on truthiness: "" meant disabled.
    const env = loadInfraEnv({
      DATABASE_DRIVER: "",
      OTEL_EXPORTER_OTLP_ENDPOINT: "",
    });
    expect(env.databaseDriver).toBeUndefined();
    expect(env.otlpEndpoint).toBeUndefined();
  });

  it("keeps the strict SEED_DB=true contract", () => {
    // Previously `process.env["SEED_DB"] === "true"`: anything else, including
    // "1", must not trigger seeding.
    expect(loadInfraEnv({ SEED_DB: "1" }).seedDatabase).toBe(false);
    expect(loadInfraEnv({ SEED_DB: "TRUE" }).seedDatabase).toBe(false);
    expect(loadInfraEnv({}).seedDatabase).toBe(false);
  });

  it("tolerates unrelated keys in the source", () => {
    const env = loadInfraEnv({ UNRELATED: "value", PATH: "/usr/bin" });
    expect(env.databaseDriver).toBeUndefined();
    expect(env.seedDatabase).toBe(false);
  });

  it("exposes every driver value the app distinguishes", () => {
    for (const driver of ["local", "e2e", "pglite"]) {
      expect(loadInfraEnv({ DATABASE_DRIVER: driver }).databaseDriver).toBe(
        driver,
      );
    }
  });
});

describe(loadClientEnv, () => {
  it("uses stage-derived URLs for deployable builds", () => {
    const env = loadClientEnv(makeClientEnv());

    expect(env.VITE_BASE_URL).toBe("https://sakuga.ozaki.one");
    expect(env.VITE_CLOUDFLARE_R2_PUBLIC_URL).toBe("https://media.ozaki.one");
  });

  it("keeps explicit URLs for a local dev server", () => {
    const env = loadClientEnv(
      makeClientEnv({
        BASE_URL: "http://localhost:5173/",
        DEV: true,
        MODE: "development",
        PROD: false,
        VITE_BASE_URL: "http://localhost:5173",
        VITE_CLOUDFLARE_R2_PUBLIC_URL: "http://localhost:9000/e2e-test",
      }),
    );

    expect(env.VITE_BASE_URL).toBe("http://localhost:5173");
    expect(env.VITE_CLOUDFLARE_R2_PUBLIC_URL).toBe(
      "http://localhost:9000/e2e-test",
    );
  });
});
