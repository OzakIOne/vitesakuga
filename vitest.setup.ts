import { execSync } from "node:child_process";

import { Data, Duration, Effect, Schedule } from "effect";

const RUSTFS_ENDPOINT = "http://localhost:9000";

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

Effect.runSync(ensureRustFS);
