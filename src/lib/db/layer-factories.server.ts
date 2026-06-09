import { Layer } from "effect";

import { AuthService, RequestHeadersService } from "../auth/context";
import { makeFromKysely } from "../effect/effect.utils";
import { withMinimumLogLevel, Debug } from "../effect/logger";
import { TracingLive } from "../effect/tracing";
import { KyselyDB } from "./context";

const LOG_LAYER = withMinimumLogLevel(Debug);

const isE2E = process.env.DATABASE_DRIVER === "pglite";

export const makeDBLayer = async () => {
  const dbModule = isE2E
    ? await import("./e2e-db")
    : await import("./kysely");

  const kyselyInstance = isE2E
    ? await (dbModule as typeof import("./e2e-db")).createE2EKysely()
    : (dbModule as typeof import("./kysely")).kysely;

  const { StorageLive } = await import("../storage/storage.s3");

  return Layer.mergeAll(
    Layer.succeed(KyselyDB)(makeFromKysely(kyselyInstance)),
    StorageLive,
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
