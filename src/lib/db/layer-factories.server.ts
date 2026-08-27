import type { UserWithTwoFactor } from "better-auth/plugins";
import { Layer } from "effect";

import {
  AuthService,
  RequestHeadersService,
  type AuthSessionProvider,
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
        Layer.succeed(AuthService)(toAuthSessionProvider(auth)),
        Layer.succeed(RequestHeadersService)(getRequestHeaders),
      ),
    ),
  );

// In-memory PGlite instance instead of a real Postgres connection. Note this
// is distinct from DATABASE_DRIVER=e2e (the Playwright webServer, which uses
// the regular local Postgres path via pool.ts).
const isPglite = envInfra.databaseDriver === "pglite";

type AuthInstance = typeof import("../auth").auth;

/**
 * Adapt the better-auth instance to the Effect `AuthService` contract.
 *
 * The two-factor plugin adds `twoFactorEnabled` to the returned session user
 * at runtime, but better-auth's `getSession` typing in 1.7.0-rc.4 does not
 * carry plugin `additionalFields` on the user model. The explicit
 * `asResponse`/`returnHeaders` flags select the object-returning overload.
 */
const toAuthSessionProvider = (auth: AuthInstance): AuthSessionProvider => ({
  api: {
    getSession: async (args) => {
      const result = await auth.api.getSession({
        headers: args.headers,
        query: args.query,
        asResponse: false,
        returnHeaders: false,
      });
      if (!result) return null;
      // SAFETY: plugins add `twoFactorEnabled` and this app adds `role` to
      // the returned user at runtime, so the runtime session user always
      // carries them even though the rc.4 types only model the base `User`;
      // the double cast bridges better-auth's narrower inferred type.
      return {
        session: result.session,
        user: result.user as unknown as UserWithTwoFactor,
      };
    },
  },
});

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
