import { Layer } from "effect";

import { AuthService, RequestHeadersService } from "../auth/context";
import { makeFromKysely } from "../effect/effect.utils";
import { withMinimumLogLevel, Debug } from "../effect/logger";
import { TracingLive } from "../effect/tracing";
import { KyselyDB } from "./context";

const LOG_LAYER = withMinimumLogLevel(Debug);

export const makeDBLayer = async () => {
  const { kysely } = await import("./kysely");
  return Layer.mergeAll(
    Layer.succeed(KyselyDB)(makeFromKysely(kysely)),
    LOG_LAYER,
    TracingLive,
  );
};

export const makeAuthLayer = async () => {
  const [{ auth }, { getRequestHeaders }] = await Promise.all([
    import("../auth"),
    import("@tanstack/react-start/server"),
  ]);
  const dbLayer = await makeDBLayer();
  return Layer.mergeAll(
    dbLayer,
    Layer.succeed(AuthService)(auth),
    Layer.succeed(RequestHeadersService)(() => getRequestHeaders()),
  );
};

export const makeMiddlewareLayer = async () => {
  const [{ auth }, { getRequestHeaders }] = await Promise.all([
    import("../auth"),
    import("@tanstack/react-start/server"),
  ]);
  return Layer.mergeAll(
    Layer.succeed(AuthService)(auth),
    Layer.succeed(RequestHeadersService)(() => getRequestHeaders()),
    LOG_LAYER,
    TracingLive,
  );
};
