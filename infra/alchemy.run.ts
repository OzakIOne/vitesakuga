import * as Alchemy from "alchemy";
import { Stage } from "alchemy";
import * as Cloudflare from "alchemy/Cloudflare";
import * as Neon from "alchemy/Neon";
import { Config, Console, Effect, Layer } from "effect";

/**
 * Stage → subdomain suffix mapping. Dev gets `-dev`, production keeps the
 * bare domain (sakuga.ozaki.one / media.ozaki.one).
 */
const domainSuffix = (stage: string) => (stage === "dev" ? "-dev" : "");

/**
 * Neon-backed database wiring. The resources are ready below but need
 * Neon credentials first: run `nub exec alchemy login` and pick Neon, then
 * flip this to `true` and deploy. While `false`, the Worker keeps reading
 * DATABASE_URL from the stage env file.
 */
const neonEnabled = false;

export default Alchemy.Stack(
  "vitesakuga-infra",
  {
    providers: Layer.mergeAll(
      Cloudflare.providers(),
      ...(neonEnabled ? [Neon.providers()] : []),
    ),
    state: Cloudflare.state(),
  },
  Effect.gen(function* () {
    const stage = yield* Stage;

    const suffix = domainSuffix(stage);
    // Fully stage-scoped bucket name: the EU jurisdiction is fixed at bucket
    // creation, so each stage gets its own bucket (vitesakuga-media-dev,
    // vitesakuga-media-production).
    const bucketName = `vitesakuga-media-${stage}`;
    const appDomain = `sakuga${suffix}.ozaki.one`;
    const mediaDomain = `media${suffix}.ozaki.one`;

    yield* Effect.logInfo(
      `Initializing Alchemy deployment for stage "${stage}" (bucket: ${bucketName}, app: ${appDomain})...`,
    );

    // ---- Neon (serverless Postgres) --------------------------------------
    //
    // One shared project with two branches, mirroring the app stages:
    //   - "production"  — the long-lived, protected branch (main data).
    //   - "development" — a copy-on-write fork used by the dev stage.
    //
    // The project is currently owned by the `dev` stage (the active
    // environment); the `production` stage references it through
    // `Resource.ref` instead of provisioning its own cluster. Drizzle
    // migrations in `./drizzle` are applied to each branch by alchemy on
    // deploy.
    const isProduction = stage === "production";

    // Branches: production is the long-lived protected branch; development
    // is a copy-on-write fork used by the dev stage. Production stage reads
    // both through `Resource.ref` from the stage that owns them (dev, for
    // now — flip ownership when production becomes the deployable owner).
    const appBranch = neonEnabled
      ? yield* isProduction
          ? Neon.Branch.ref("ProductionBranch", { stage: "dev" })
          : Effect.gen(function* () {
              const sakugaDatabase = yield* Neon.Project("SakugaDatabase", {
                name: "vitesakuga",
                region: "aws-eu-central-1",
                pgVersion: 17,
              });
              const productionBranch = yield* Neon.Branch("ProductionBranch", {
                project: sakugaDatabase,
                name: "production",
                protected: true,
                migrationsDir: "./drizzle",
              });
              return yield* Neon.Branch("DevelopmentBranch", {
                project: sakugaDatabase,
                name: "development",
                parentBranch: productionBranch,
                migrationsDir: "./drizzle",
              });
            })
      : undefined;

    const SakugaBucket = Cloudflare.R2.Bucket("SakugaBucket", {
      name: bucketName,
      // EU data residency + Western Europe storage location.
      jurisdiction: "eu",
      locationHint: "weur",
      // Public bucket domain, e.g. media-dev.ozaki.one.
      domains: [{ name: mediaDomain }],
      // Only the app domain (and localhost in dev) may read the bucket from
      // the browser. Videos upload direct-to-R2 via presigned PUTs, so the app
      // origin may also PUT; DELETE stays server-side.
      cors: [
        {
          allowedMethods: ["GET", "HEAD", "PUT"],
          allowedOrigins:
            stage === "dev"
              ? [
                  `https://${appDomain}`,
                  "http://localhost:3000",
                  "http://localhost:5173",
                ]
              : [`https://${appDomain}`],
          allowedHeaders: ["range", "content-type"],
          exposeHeaders: ["etag", "content-range", "accept-ranges"],
          maxAgeSeconds: 3600,
        },
      ],
    });

    const bucket = yield* SakugaBucket;

    // Invisible Cloudflare Turnstile widget for the auth endpoints (production
    // stage only; harmless in dev since the app gates the captcha plugin).
    // `sitekey` is public (rendered in the sign-in form), `secret` is verified
    // server-side by the Better Auth captcha plugin and bound as a secret.
    const turnstile = yield* Cloudflare.Turnstile.Widget("SakugaTurnstile", {
      name: `sakuga-turnstile-${stage}`,
      domains: [appDomain],
      mode: "invisible",
    });

    const SakugaWorker = Cloudflare.Worker("SakugaWorker", {
      // Nitro `cloudflare_module` build output (see nitro.config.ts). Run
      // `nub run build` before deploying so `.output/` exists.
      main: "./.output/server/index.mjs",
      bundle: false,
      assets: "./.output/public",
      // Mirrors nitro.config.ts (compatibilityDate + nodejs_compat) so the
      // generated wrangler.json settings survive the alchemy deploy path.
      compatibility: {
        date: "2026-04-21",
        // nodejs_compat_populate_process_env exposes the worker bindings
        // (vars + secrets) via process.env, which the app reads through
        // loadServerEnv(process.env).
        flags: ["nodejs_compat", "nodejs_compat_populate_process_env"],
      },
      workersDev: false,
      domain: appDomain,
      env: {
        BETTER_AUTH_SECRET: Config.redacted("BETTER_AUTH_SECRET"),
        CLOUDFLARE_ACCESS_KEY: Config.redacted("CLOUDFLARE_ACCESS_KEY"),
        CLOUDFLARE_BUCKET: Config.string("CLOUDFLARE_BUCKET"),
        CLOUDFLARE_R2: Config.string("CLOUDFLARE_R2"),
        VITE_CLOUDFLARE_R2_PUBLIC_URL: Config.string(
          "VITE_CLOUDFLARE_R2_PUBLIC_URL",
        ),
        CLOUDFLARE_SECRET_KEY: Config.redacted("CLOUDFLARE_SECRET_KEY"),
        DATABASE_URL:
          appBranch === undefined
            ? Config.redacted("DATABASE_URL")
            : appBranch.pooledConnectionUri,
        GITHUB_CLIENT_ID: Config.string("GITHUB_CLIENT_ID"),
        GITHUB_CLIENT_SECRET: Config.redacted("GITHUB_CLIENT_SECRET"),
        GOOGLE_CLIENT_ID: Config.string("GOOGLE_CLIENT_ID"),
        GOOGLE_CLIENT_SECRET: Config.redacted("GOOGLE_CLIENT_SECRET"),
        NODE_ENV: Config.string("NODE_ENV").pipe(
          Config.withDefault("production"),
        ),
        // Cloudflare Rate Limiting binding (edge, per-IP). Consumed in the
        // Nitro runtime via `event.req.runtime.cloudflare.env.RATE_LIMIT`.
        RATE_LIMIT: Cloudflare.RateLimit("RATE_LIMIT", {
          namespaceId: 1001,
          simple: { limit: 100, period: 60 },
        }),
        // Turnstile widget keys: sitekey is public, secret is server-only.
        TURNSTILE_SITEKEY: turnstile.sitekey,
        TURNSTILE_SECRET: turnstile.secret,
        VITE_BASE_URL: Config.string("VITE_BASE_URL"),
      },
    });

    const worker = yield* SakugaWorker;
    const accountId = yield* Config.string("CLOUDFLARE_ACCOUNT_ID");

    // Cloudflare Access: the app is only reachable by the owner's email.
    // Set CLOUDFLARE_ACCESS_EMAIL in the stage env file.
    const ownerEmail = yield* Config.string("CLOUDFLARE_ACCESS_EMAIL");
    const allowOwner = yield* Cloudflare.Access.Policy("AllowOwner", {
      name: `Allow owner (${stage})`,
      decision: "allow",
      include: [{ email: { email: ownerEmail } }],
    });

    yield* Cloudflare.Access.Application("SakugaAccess", {
      type: "self_hosted",
      domain: appDomain,
      sessionDuration: "720h",
      policies: [allowOwner.policyId],
    });

    yield* Console.log("\n✅ Deployment successfully orchestrated!");
    yield* Console.log("\n--- Action Required ---");
    yield* Console.log(
      "Please ensure the following values are updated in your env file:",
    );
    yield* Console.log(`\nAPP_URL="https://${appDomain}"`);
    yield* Console.log(`MEDIA_URL="https://${mediaDomain}"`);
    yield* Console.log(`CLOUDFLARE_ACCESS_EMAIL="${ownerEmail}"`);
    yield* Console.log(`\nCLOUDFLARE_BUCKET="${bucketName}"`);
    yield* Console.log(
      `VITE_CLOUDFLARE_R2_PUBLIC_URL="https://${mediaDomain}"`,
    );
    yield* Console.log(
      `CLOUDFLARE_R2="https://${accountId}.eu.r2.cloudflarestorage.com"`,
    );
    yield* Console.log("-----------------------\n");
    yield* Console.log(
      `(R2 Endpoint for reference: https://${accountId}.eu.r2.cloudflarestorage.com)`,
    );

    return {
      bucketName: bucket.bucketName,
      appUrl: worker.url,
      accountId,
      databaseUrl: appBranch?.pooledConnectionUri,
      databaseUrlDirect: appBranch?.connectionUri,
      branchId: appBranch?.branchId,
    };
  }),
);
