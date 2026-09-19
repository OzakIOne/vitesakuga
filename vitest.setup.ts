import { execSync } from "node:child_process";

import { S3Client } from "@aws-sdk/client-s3";
import { Data, Duration, Effect, Schedule } from "effect";

import { ensureTestBucket } from "./e2e/test-bucket";

const RUSTFS_ENDPOINT = "http://localhost:9000";
const RUSTFS_ACCESS_KEY = "rustfsadmin";
const RUSTFS_SECRET_KEY = "rustfsadmin";
const TEST_BUCKET = "e2e-test";

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

const isRunning = Effect.gen(function* () {
  const status = yield* curlStatus(`${RUSTFS_ENDPOINT}/`);
  return status === "403" || status === "200";
});

const waitForHealth = Effect.gen(function* () {
  yield* Effect.log("Waiting for RustFS...");

  yield* Effect.retry(
    Effect.gen(function* () {
      yield* Effect.sleep(Duration.seconds(1));
      const ready = yield* isRunning;
      if (ready) return;
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

const ensureRustFS = Effect.gen(function* () {
  yield* Effect.log("Checking RustFS...");

  const running = yield* isRunning;
  if (running) {
    yield* Effect.log("RustFS is running");
    return;
  }

  yield* Effect.log("Starting RustFS...");
  yield* exec("docker compose up -d rustfs").pipe(
    Effect.catch((error) =>
      Effect.gen(function* () {
        yield* Effect.logError(
          `Failed to start RustFS: ${error instanceof CommandError ? error.message : String(error)}`,
        );
        return yield* Effect.die("RustFS not available");
      }),
    ),
  );

  yield* waitForHealth;
});

const ensureTestBucketReady = Effect.gen(function* () {
  const client = new S3Client({
    endpoint: RUSTFS_ENDPOINT,
    region: "us-east-1",
    credentials: {
      accessKeyId: RUSTFS_ACCESS_KEY,
      secretAccessKey: RUSTFS_SECRET_KEY,
    },
    forcePathStyle: true,
  });

  yield* ensureTestBucket(client, TEST_BUCKET).pipe(
    Effect.ensuring(Effect.sync(() => client.destroy())),
  );
  yield* Effect.log(`Bucket "${TEST_BUCKET}" ready`);
});

await Effect.runPromise(ensureRustFS);
await Effect.runPromise(ensureTestBucketReady);
