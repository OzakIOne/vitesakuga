import * as Alchemy from "alchemy";
import * as Cloudflare from "alchemy/Cloudflare";
import { Config, Console, Effect } from "effect";

const SakugaBucket = Cloudflare.R2.Bucket("SakugaBucket", {
  name: "vitesakuga-media",
});

export default Alchemy.Stack(
  "vitesakuga-infra",
  {
    providers: Cloudflare.providers(),
    state: Cloudflare.state(),
  },
  Effect.gen(function* () {
    yield* Effect.logInfo("Initializing Alchemy deployment...");

    const bucket = yield* SakugaBucket;
    const accountId = yield* Config.string("CLOUDFLARE_ACCOUNT_ID");

    yield* Console.log("\n✅ Deployment successfully orchestrated!");
    yield* Console.log("\n--- Action Required ---");
    yield* Console.log(
      "Please ensure the following values are updated in your .env file:",
    );
    yield* Console.log(`\nCLOUDFLARE_BUCKET="${bucket.bucketName}"`);
    yield* Console.log(`CLOUDFLARE_R2="${accountId}"`);
    yield* Console.log("-----------------------\n");
    yield* Console.log(
      `(R2 Endpoint for reference: https://${accountId}.r2.cloudflarestorage.com)`,
    );

    return { bucketName: bucket.bucketName, accountId };
  }),
);
