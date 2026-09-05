import { execSync } from "node:child_process";
import { fileURLToPath } from "node:url";

import { Data, Duration, Effect, Schedule } from "effect";

const REPO_ROOT = fileURLToPath(new URL("..", import.meta.url));
const RUSTFS_ENDPOINT = "http://localhost:9000";
const RUSTFS_ACCESS_KEY = "rustfsadmin";
const RUSTFS_SECRET_KEY = "rustfsadmin";
const BUCKET = "e2e-test";

class CommandError extends Data.TaggedError("CommandError")<{
  readonly command: string;
  readonly message: string;
}> {}

const exec = (cmd: string, options: { cwd?: string } = {}) =>
  Effect.try({
    try: () =>
      execSync(cmd, {
        cwd: options.cwd,
        encoding: "utf-8",
        stdio: "pipe",
      }).trim(),
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
          message: `Failed to start RustFS: ${error instanceof CommandError ? error.message : error}`,
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

const ensurePostgres = Effect.gen(function* () {
  yield* Effect.log("Checking local Postgres...");
  yield* exec("docker compose up -d postgres", { cwd: REPO_ROOT }).pipe(
    Effect.catch((error) =>
      Effect.fail(
        new CommandError({
          command: "docker compose",
          message: `Failed to start Postgres: ${error instanceof Error ? error.message : error}`,
        }),
      ),
    ),
  );
  yield* Effect.log("Postgres is up");
});

const migrateDatabase = Effect.gen(function* () {
  yield* Effect.log("Applying database migrations...");

  yield* Effect.retry(
    Effect.gen(function* () {
      yield* Effect.sleep(Duration.seconds(1));
      yield* exec(
        "DATABASE_URL='postgresql://user:password@localhost:5432/sakuga?sslmode=disable' nub e2e/migrate-local.mjs",
        { cwd: REPO_ROOT },
      ).pipe(Effect.catch(() => Effect.fail("migrations not ready")));
    }),
    Schedule.recurs(30),
  ).pipe(
    Effect.catch(() =>
      Effect.fail(
        new CommandError({
          command: "migrate-local.mjs",
          message: "Database migrations failed",
        }),
      ),
    ),
  );

  yield* Effect.log("Database migrations applied");
});

const setup = Effect.gen(function* () {
  yield* startRustFS;
  yield* ensurePostgres;
  yield* migrateDatabase;
  yield* createBucket;
});

export default async function globalSetup(): Promise<void> {
  // A failed environment must fail the Playwright run here, loudly — the
  // alternative (logging a warning and continuing) sends the suite against a
  // broken stack and every test fails with confusing downstream errors.
  await Effect.runPromise(
    setup.pipe(
      Effect.tapError((error) =>
        Effect.logError("E2E environment setup failed").pipe(
          Effect.annotateLogs({
            error: error instanceof Error ? error.message : String(error),
          }),
        ),
      ),
    ),
  );
}
