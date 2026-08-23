import { describe, expect, it } from "vitest";

import { loadInfraEnv } from "./defs";

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
