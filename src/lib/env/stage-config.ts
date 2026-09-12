export type ApplicationStage = "local" | "dev" | "prod";

export type StageConfiguration = {
  readonly appDomain: string;
  readonly appUrl: string;
  readonly bucketName: string;
  readonly mediaDomain: string;
  readonly mediaUrl: string;
};

export const stageConfig = {
  local: {
    appDomain: "localhost:3200",
    appUrl: "http://localhost:3200",
    bucketName: "e2e-test",
    mediaDomain: "localhost:9000",
    mediaUrl: "http://localhost:9000/e2e-test",
  },
  dev: {
    appDomain: "sakuga-dev.ozaki.one",
    appUrl: "https://sakuga-dev.ozaki.one",
    bucketName: "vitesakuga-media-dev",
    mediaDomain: "media-dev.ozaki.one",
    mediaUrl: "https://media-dev.ozaki.one",
  },
  prod: {
    appDomain: "sakuga.ozaki.one",
    appUrl: "https://sakuga.ozaki.one",
    bucketName: "vitesakuga-media-production",
    mediaDomain: "media.ozaki.one",
    mediaUrl: "https://media.ozaki.one",
  },
} as const satisfies Record<ApplicationStage, StageConfiguration>;

export const getApplicationStageConfig = (mode: string): StageConfiguration => {
  if (mode === "test") {
    return stageConfig.local;
  }

  if (mode === "production") {
    return stageConfig.prod;
  }

  return stageConfig.dev;
};

export const getDeploymentStageConfig = (stage: string): StageConfiguration => {
  if (stage === "dev") {
    return stageConfig.dev;
  }

  if (stage === "production") {
    return stageConfig.prod;
  }

  throw new Error(
    `Unsupported Alchemy stage "${stage}". Expected "dev" or "production".`,
  );
};
