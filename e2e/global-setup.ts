import { execSync } from "node:child_process";

import { Data, Duration, Effect, Schedule } from "effect";

const RUSTFS_ENDPOINT = "http://localhost:9000";
const RUSTFS_ACCESS_KEY = "rustfsadmin";
const RUSTFS_SECRET_KEY = "rustfsadmin";
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
  yield* Effect.log("Waiting for RustFS...");

  yield* Effect.retry(
    Effect.gen(function* () {
      yield* Effect.sleep(Duration.seconds(1));
      const status = yield* curlStatus(`${RUSTFS_ENDPOINT}/`);
      if (status === "403" || status === "200") return;
      return yield* Effect.fail("not ready");
    }),
    Schedule.recurs(30),
  ).pipe(
    Effect.catch(() =>
      Effect.fail(
        new CommandError({ command: "curl", message: "RustFS not ready" }),
      ),
    ),
  );

  yield* Effect.log("RustFS is ready");
});

const startRustFS = Effect.gen(function* () {
  yield* Effect.log("Starting RustFS...");
  yield* exec("docker compose up -d rustfs").pipe(
    Effect.catch((error) =>
      Effect.fail(
        new CommandError({
          command: "docker compose",
          message: `Failed to start RustFS: ${error instanceof CommandError ? error.message : String(error)}`,
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
    endpoint: RUSTFS_ENDPOINT,
    region: "us-east-1",
    credentials: {
      accessKeyId: RUSTFS_ACCESS_KEY,
      secretAccessKey: RUSTFS_SECRET_KEY,
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
  yield* startRustFS;
  yield* createBucket;
}).pipe(
  Effect.catch((error) =>
    Effect.logWarning(
      `Setup warning: ${error instanceof Error ? error.message : String(error)}`,
    ),
  ),
);

export default async function globalSetup(): Promise<void> {
  await Effect.runPromise(setup);
}
