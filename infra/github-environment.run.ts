import * as Alchemy from "alchemy";
import { Stage } from "alchemy";
import * as GitHub from "alchemy/GitHub";
import { localState } from "alchemy/State";
import { Config, Effect } from "effect";

const owner = "OzakIOne";
const repository = "vitesakuga";

export default Alchemy.Stack(
  "vitesakuga-github",
  {
    providers: GitHub.providers(),
    state: localState(),
  },
  Effect.gen(function* () {
    const stage = yield* Stage;

    const configuration =
      stage === "preproduction"
        ? {
            environmentName: "preproduction",
            resourcePrefix: "Preproduction",
            workerName: "vitesakuga-infra-sakugaworker-dev-5osp6ydh4rodg534",
            healthcheckUrl: "https://sakuga-dev.ozaki.one/login",
          }
        : stage === "production"
          ? {
              environmentName: "production",
              resourcePrefix: "Production",
              workerName:
                "vitesakuga-infra-sakugaworker-production-5osp6ydh4rodg534",
              healthcheckUrl: "https://sakuga.ozaki.one/login",
            }
          : yield* Effect.die(
              `This stack manages preproduction or production, received stage "${stage}"`,
            );

    const environment = yield* GitHub.Environment(
      `${configuration.resourcePrefix}Environment`,
      {
        owner,
        repository,
        name: configuration.environmentName,
      },
    );

    yield* GitHub.Secret(`${configuration.resourcePrefix}CloudflareApiToken`, {
      owner,
      repository,
      environment,
      name: "CLOUDFLARE_API_TOKEN",
      value: yield* Config.redacted("CLOUDFLARE_API_TOKEN"),
    });

    yield* GitHub.Variable(
      `${configuration.resourcePrefix}CloudflareAccountId`,
      {
        owner,
        repository,
        environment,
        name: "CLOUDFLARE_ACCOUNT_ID",
        value: yield* Config.string("CLOUDFLARE_ACCOUNT_ID"),
      },
    );

    yield* GitHub.Variable(`${configuration.resourcePrefix}WorkerName`, {
      owner,
      repository,
      environment,
      name: "CLOUDFLARE_WORKER_NAME",
      value: Config.string("CLOUDFLARE_WORKER_NAME").pipe(
        Config.withDefault(configuration.workerName),
      ),
    });

    yield* GitHub.Variable(`${configuration.resourcePrefix}HealthcheckUrl`, {
      owner,
      repository,
      environment,
      name: "HEALTHCHECK_URL",
      value: Config.string("HEALTHCHECK_URL").pipe(
        Config.withDefault(configuration.healthcheckUrl),
      ),
    });

    return {
      environment: environment.htmlUrl,
      repository: `${owner}/${repository}`,
    };
  }),
);
