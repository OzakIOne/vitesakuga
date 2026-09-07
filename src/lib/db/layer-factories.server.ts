// oxlint-disable effecttsgo/async-function -- this module's whole contract is Promise-returning: `baseLayerFactories`/`resolveMiddlewareLayer` in server-fn.handler.ts consume makeDBLayer/makeAuthLayer/makeMiddlewareLayer via `.then((m) => m.makeX())`, and `toAuthSessionProvider.getSession` implements `AuthSessionProvider`, which returns a Promise; converting any of these to Effect would ripple through the handler contract
import { Layer } from "effect";

import { makeBetterAuthSessionProvider } from "../auth/better-auth.adapter.server";
import {
  AuthService,
  RequestHeadersService,
  makeAuthService,
} from "../auth/context";
import { SessionServiceLive } from "../auth/session.effect";
import { makeFromKysely } from "../effect/effect.utils";
import { withMinimumLogLevel } from "../effect/logger";
import { TracingLive } from "../effect/tracing";
import { envInfra } from "../env/infra";
import { KyselyDB } from "./context";

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

// In-memory PGlite instance instead of a real Postgres connection. Note this
// is distinct from DATABASE_DRIVER=e2e (the Playwright webServer, which uses
// the regular local Postgres path via pool.ts).
const isPglite = envInfra.databaseDriver === "pglite";

type AuthInstance = typeof import("../auth").auth;

export const makeDBLayer = async () => {
  const dbModule = isPglite
    ? await import("./e2e-db")
    : await import("./kysely");

  // SAFETY: dbModule is the static import of "./e2e-db" in the isPglite branch
  // and of "./kysely" otherwise, so each cast matches the module actually
  // loaded above.
  const kyselyInstance = isPglite
    ? await (dbModule as typeof import("./e2e-db")).createE2EKysely()
    : (dbModule as typeof import("./kysely")).kysely;

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
    import("../auth"),
    import("@tanstack/react-start/server"),
    makeDBLayer(),
  ]);
  return Layer.mergeAll(dbLayer, makeSessionLayer(auth, getRequestHeaders));
};

export const makeMiddlewareLayer = async () => {
  const [{ auth }, { getRequestHeaders }] = await Promise.all([
    import("../auth"),
    import("@tanstack/react-start/server"),
  ]);
  return Layer.mergeAll(
    makeSessionLayer(auth, getRequestHeaders),
    LOG_LAYER,
    TracingLive,
  );
};
