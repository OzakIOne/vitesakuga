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

    if (stage !== "preproduction") {
      return yield* Effect.die(
        `This stack manages the preproduction GitHub environment, received stage "${stage}"`,
      );
    }

    const environment = yield* GitHub.Environment("PreproductionEnvironment", {
      owner,
      repository,
      name: "preproduction",
    });

    yield* GitHub.Secret("PreproductionCloudflareApiToken", {
      owner,
      repository,
      environment,
      name: "CLOUDFLARE_API_TOKEN",
      value: yield* Config.redacted("CLOUDFLARE_API_TOKEN"),
    });

    yield* GitHub.Variable("PreproductionCloudflareAccountId", {
      owner,
      repository,
      environment,
      name: "CLOUDFLARE_ACCOUNT_ID",
      value: yield* Config.string("CLOUDFLARE_ACCOUNT_ID"),
    });

    yield* GitHub.Variable("PreproductionWorkerName", {
      owner,
      repository,
      environment,
      name: "CLOUDFLARE_WORKER_NAME",
      value: Config.string("CLOUDFLARE_WORKER_NAME").pipe(
        Config.withDefault(
          "vitesakuga-infra-sakugaworker-dev-5osp6ydh4rodg534",
        ),
      ),
    });

    yield* GitHub.Variable("PreproductionHealthcheckUrl", {
      owner,
      repository,
      environment,
      name: "HEALTHCHECK_URL",
      value: Config.string("HEALTHCHECK_URL").pipe(
        Config.withDefault("https://sakuga-dev.ozaki.one/login"),
      ),
    });

    return {
      environment: environment.htmlUrl,
      repository: `${owner}/${repository}`,
    };
  }),
);
