import { execSync } from "node:child_process";

import { Data, Duration, Effect, Schedule } from "effect";

const GARAGE_ENDPOINT = "http://localhost:3900";
const GARAGE_ACCESS_KEY = "GK1a2b3c4d5e6f7a8b9c0d1e2f3a4b5c6d";
const GARAGE_SECRET_KEY =
  "1a2b3c4d5e6f7a8b9c0d1e2f3a4b5c6d1a2b3c4d5e6f7a8b9c0d1e2f3a4b5c6d";
const BUCKET = "e2e-test";

class CommandError extends Data.TaggedError("CommandError")<{
  readonly command: string;
  readonly message: string;
}> {}

const exec = (cmd: string) =>
  Effect.try({
    try: () => execSync(cmd, { stdio: "pipe", encoding: "utf-8" }).trim(),
    catch: () =>
      new CommandError({ command: cmd, message: `Command failed: ${cmd}` }),
  });

const curlStatus = (url: string) =>
  exec(`curl -s -o /dev/null -w "%{http_code}" ${url}`).pipe(
    Effect.catch(() => Effect.succeed("000")),
  );

const waitForHealth = Effect.gen(function* () {
  yield* Effect.log("Waiting for Garage...");

  yield* Effect.retry(
    Effect.gen(function* () {
      yield* Effect.sleep(Duration.seconds(1));
      const status = yield* curlStatus(`${GARAGE_ENDPOINT}/`);
      if (status !== "000") return;
      return yield* Effect.fail("not ready");
    }),
    Schedule.recurs(30),
  ).pipe(
    Effect.catch(() =>
      Effect.fail(
        new CommandError({ command: "curl", message: "Garage not ready" }),
      ),
    ),
  );

  yield* Effect.log("Garage is ready");
});

const startGarage = Effect.gen(function* () {
  yield* Effect.log("Starting Garage...");
  yield* exec("docker compose up -d garage").pipe(
    Effect.catch((error) =>
      Effect.fail(
        new CommandError({
          command: "docker compose",
          message: `Failed to start Garage: ${error instanceof CommandError ? error.message : error}`,
        }),
      ),
    ),
  );

  yield* waitForHealth;
});

const createBucket = Effect.gen(function* () {
  const { S3Client, CreateBucketCommand } = yield* Effect.tryPromise({
    try: () => import("@aws-sdk/client-s3"),
    catch: () => new Error("Failed to import AWS SDK"),
  });

  const client = new S3Client({
    endpoint: GARAGE_ENDPOINT,
    region: "garage",
    credentials: {
      accessKeyId: GARAGE_ACCESS_KEY,
      secretAccessKey: GARAGE_SECRET_KEY,
    },
    forcePathStyle: true,
  });

  yield* Effect.tryPromise({
    try: () => client.send(new CreateBucketCommand({ Bucket: BUCKET })),
    catch: () => new Error("Bucket creation failed"),
  }).pipe(Effect.catch(() => Effect.log("Bucket already exists or created")));

  yield* Effect.log(`Bucket "${BUCKET}" ready`);
});

const setup = Effect.gen(function* () {
  yield* startGarage;
  yield* createBucket;
}).pipe(
  Effect.catch((error) =>
    Effect.logWarning(
      `Setup warning: ${error instanceof Error ? error.message : error}`,
    ),
  ),
);

export default async function globalSetup(): Promise<void> {
  await Effect.runPromise(setup);
}
