import { Config, Console, Effect } from "effect";
import { R2Bucket } from "alchemy/cloudflare";
import alchemy from "alchemy";

const deploy = Effect.gen(function* () {
  const accountId = yield* Config.string("CLOUDFLARE_ACCOUNT_ID");

  yield* Effect.logInfo("Initializing Alchemy deployment...");

  const app = yield* Effect.tryPromise({
    try: () => alchemy("vitesakuga-infra"),
    catch: (error) => new Error(`Failed to initialize alchemy app: ${String(error)}`),
  });

  const bucket = yield* Effect.tryPromise({
    try: () =>
      R2Bucket("sakuga-bucket", {
        name: "vitesakuga-media",
      }),
    catch: (error) => new Error(`Failed to create R2Bucket: ${String(error)}`),
  });

  yield* Console.log("\n✅ Deployment successfully orchestrated!");
  yield* Console.log("\n--- Action Required ---");
  yield* Console.log("Please ensure the following values are updated in your .env file:");
  yield* Console.log(`\nCLOUDFLARE_BUCKET="${bucket.name}"`);
  yield* Console.log(`CLOUDFLARE_R2="${accountId}"`);
  yield* Console.log("-----------------------\n");
  yield* Console.log(`(R2 Endpoint for reference: https://${accountId}.r2.cloudflarestorage.com)`);

  yield* Effect.tryPromise({
    try: () => app.finalize(),
    catch: (error) => new Error(`Failed to finalize alchemy app: ${String(error)}`),
  });
});

Effect.runPromise(deploy).catch(console.error);
