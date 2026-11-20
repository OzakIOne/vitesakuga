// oxlint-disable effecttsgo/async-function -- the exported layer factories return Promises because `baseLayerFactories`/`resolveMiddlewareLayer` in server-fn.handler.ts consume them through the server-function boundary; keeping dynamic imports and layer construction in native async functions avoids changing that contract
import { Layer } from "effect";

import { makeBetterAuthSessionProvider } from "../auth/better-auth.adapter.server";
import {
  AuthService,
  RequestHeadersService,
  makeAuthService,
} from "../auth/context";
import { SessionServiceLive } from "../auth/session.effect";
import { withMinimumLogLevel } from "../effect/logger";
import { TracingLive } from "../effect/tracing";
import { envInfra } from "../env/infra";
import { KyselyDB } from "./context";
import { makeFromKysely } from "./effect-kysely";

const LOG_LAYER = withMinimumLogLevel("Debug");

/**
 * `SessionServiceLive` fed by the raw Better Auth instance and the request
 * headers factory — the only consumers of those low-level services.
 */
const makeSessionLayer = (
  auth: AuthInstance,
  getRequestHeaders: () => Headers,
) =>
  SessionServiceLive.pipe(
    Layer.provide(
      Layer.mergeAll(
        Layer.succeed(AuthService)(
          makeAuthService(makeBetterAuthSessionProvider(auth)),
        ),
        Layer.succeed(RequestHeadersService)(getRequestHeaders),
      ),
    ),
  );

type AuthInstance = typeof import("../auth/instance").auth;

const loadKyselyInstance = async () => {
  switch (envInfra.databaseDriver) {
    case "pglite": {
      const { createE2EKysely } = await import("./e2e-db");
      return createE2EKysely();
    }
    case "local":
    case "e2e":
    case "neon": {
      const { kysely } = await import("./kysely");
      return kysely;
    }
  }
};

export const makeDBLayer = async () => {
  const kyselyInstance = await loadKyselyInstance();

  const { StorageLive } = await import("../storage/storage.adapter");

  return Layer.mergeAll(
    Layer.succeed(KyselyDB)(makeFromKysely(kyselyInstance)),
    StorageLive,
    LOG_LAYER,
    TracingLive,
  );
};

export const makeAuthLayer = async () => {
  const [{ auth }, { getRequestHeaders }, dbLayer] = await Promise.all([
    import("../auth/instance"),
    import("@tanstack/react-start/server"),
    makeDBLayer(),
  ]);
  return Layer.mergeAll(dbLayer, makeSessionLayer(auth, getRequestHeaders));
};

export const makeMiddlewareLayer = async () => {
  const [{ auth }, { getRequestHeaders }] = await Promise.all([
    import("../auth/instance"),
    import("@tanstack/react-start/server"),
  ]);
  return Layer.mergeAll(
    makeSessionLayer(auth, getRequestHeaders),
    LOG_LAYER,
    TracingLive,
  );
};
