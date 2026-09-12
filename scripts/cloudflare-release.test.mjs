import { describe, expect, it } from "vitest";

import {
  createRollbackCommand,
  exceedsErrorRateThreshold,
  getErrorRate,
  parseNumberValue,
  selectActiveVersion,
  validateMonitoringConfiguration,
} from "./cloudflare-release-core.mjs";

describe("Cloudflare release safety decisions", () => {
  it("selects the highest-percentage version from the newest deployment", () => {
    const activeVersion = selectActiveVersion([
      {
        created_on: "2026-09-11T12:00:00.000Z",
        versions: [{ version_id: "old", percentage: 1 }],
      },
      {
        createdOn: "2026-09-12T12:00:00.000Z",
        versions: [
          { version_id: "canary", percentage: 0.2 },
          { version_id: "active", percentage: 0.8 },
        ],
      },
    ]);

    expect(activeVersion?.version_id).toBe("active");
  });

  it("returns zero error rate when there is no traffic", () => {
    expect(getErrorRate({ errors: 0, requests: 0 })).toBe(0);
  });

  it("only trips the monitor after the minimum request count", () => {
    const threshold = {
      maxErrorRate: 0.1,
      minRequests: 20,
    };

    expect(
      exceedsErrorRateThreshold({
        metrics: { errors: 5, requests: 10 },
        ...threshold,
      }),
    ).toBe(false);
    expect(
      exceedsErrorRateThreshold({
        metrics: { errors: 2, requests: 20 },
        ...threshold,
      }),
    ).toBe(false);
    expect(
      exceedsErrorRateThreshold({
        metrics: { errors: 3, requests: 20 },
        ...threshold,
      }),
    ).toBe(true);
  });

  it("rejects invalid monitoring configuration", () => {
    expect(() =>
      validateMonitoringConfiguration({
        maxErrorRate: 1.1,
        minRequests: 20,
        attempts: 5,
        intervalMilliseconds: 60_000,
      }),
    ).toThrow("MAX_ERROR_RATE must be between 0 and 1");
    expect(() =>
      validateMonitoringConfiguration({
        maxErrorRate: 0.1,
        minRequests: 0,
        attempts: 5,
        intervalMilliseconds: 60_000,
      }),
    ).toThrow("Monitoring thresholds must be positive");
  });

  it("parses integer configuration without widening invalid values", () => {
    expect(
      parseNumberValue({
        name: "MONITOR_ATTEMPTS",
        value: "5",
        fallback: 3,
        integer: true,
      }),
    ).toBe(5);
    expect(() =>
      parseNumberValue({
        name: "MONITOR_ATTEMPTS",
        value: "1.5",
        fallback: 3,
        integer: true,
      }),
    ).toThrow("MONITOR_ATTEMPTS must be a valid integer");
  });

  it("builds the rollback command against the captured version", () => {
    expect(
      createRollbackCommand({
        previousVersionId: "previous-version",
        workerName: "sakuga",
        deployedVersionId: "deployed-version",
      }),
    ).toEqual({
      command: "nubx",
      args: [
        "wrangler",
        "rollback",
        "previous-version",
        "--name",
        "sakuga",
        "--message",
        "Automatic rollback after failed release health checks (deployed-version)",
      ],
    });
  });
});
