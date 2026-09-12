import { describe, expect, it } from "vitest";

import {
  getApplicationStageConfig,
  getDeploymentStageConfig,
  stageConfig,
} from "./stage-config";

describe("stage configuration", () => {
  it("maps Vite modes to the matching application stage", () => {
    expect(getApplicationStageConfig("test")).toBe(stageConfig.local);
    expect(getApplicationStageConfig("development")).toBe(stageConfig.dev);
    expect(getApplicationStageConfig("production")).toBe(stageConfig.prod);
  });

  it("maps Alchemy stages to the matching application stage", () => {
    expect(getDeploymentStageConfig("dev")).toBe(stageConfig.dev);
    expect(getDeploymentStageConfig("production")).toBe(stageConfig.prod);
  });

  it("rejects an unknown Alchemy stage", () => {
    expect(() => getDeploymentStageConfig("preview")).toThrow(
      'Unsupported Alchemy stage "preview"',
    );
  });
});
