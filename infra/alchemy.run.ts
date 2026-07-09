import alchemy from "alchemy";
import { R2Bucket } from "alchemy/cloudflare";
import { Config, Console, Data, Effect } from "effect";

class InfrastructureError extends Data.TaggedError("InfrastructureError")<{
  readonly message: string;
  readonly cause?: unknown;
}> {}

const deploy = Effect.gen(function* () {
  const accountId = yield* Config.string("CLOUDFLARE_ACCOUNT_ID");

  yield* Effect.logInfo("Initializing Alchemy deployment...");

  const app = yield* Effect.tryPromise({
    try: () => alchemy("vitesakuga-infra"),
    catch: (error) =>
      new InfrastructureError({
        message: "Failed to initialize alchemy app",
        cause: error,
      }),
  });

  const bucket = yield* Effect.tryPromise({
    try: () =>
      R2Bucket("sakuga-bucket", {
        name: "vitesakuga-media",
      }),
    catch: (error) =>
      new InfrastructureError({
        message: "Failed to create R2Bucket",
        cause: error,
      }),
  });

  yield* Console.log("\n✅ Deployment successfully orchestrated!");
  yield* Console.log("\n--- Action Required ---");
  yield* Console.log(
    "Please ensure the following values are updated in your .env file:",
  );
  yield* Console.log(`\nCLOUDFLARE_BUCKET="${bucket.name}"`);
  yield* Console.log(`CLOUDFLARE_R2="${accountId}"`);
  yield* Console.log("-----------------------\n");
  yield* Console.log(
    `(R2 Endpoint for reference: https://${accountId}.r2.cloudflarestorage.com)`,
  );

  yield* Effect.tryPromise({
    try: () => app.finalize(),
    catch: (error) =>
      new InfrastructureError({
        message: "Failed to finalize alchemy app",
        cause: error,
      }),
  });
});

Effect.runPromise(deploy).catch((error) => {
  throw new Error(`Deployment failed: ${error}`);
});
