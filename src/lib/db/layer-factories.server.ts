import type { UserWithTwoFactor } from "better-auth/plugins";
import { Layer } from "effect";

import {
  AuthService,
  RequestHeadersService,
  type AuthSessionProvider,
} from "../auth/context";
import { makeFromKysely } from "../effect/effect.utils";
import { withMinimumLogLevel } from "../effect/logger";
import { TracingLive } from "../effect/tracing";
import { KyselyDB } from "./context";

const LOG_LAYER = withMinimumLogLevel("Debug");

const isE2E = process.env["DATABASE_DRIVER"] === "pglite";

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
      // SAFETY: the two-factor plugin registers `twoFactorEnabled` as a
      // returned user field, so the runtime session user always carries it
      // even though the rc.4 types only model the base `User`.
      return {
        session: result.session,
        user: result.user as UserWithTwoFactor,
      };
    },
  },
});

export const makeDBLayer = async () => {
  const dbModule = isE2E ? await import("./e2e-db") : await import("./kysely");

  // SAFETY: dbModule is the static import of "./e2e-db" in the isE2E branch and of
  // "./kysely" otherwise, so each cast matches the module actually loaded above.
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
  const [{ auth }, { getRequestHeaders }, dbLayer] = await Promise.all([
    import("../auth"),
    import("@tanstack/react-start/server"),
    makeDBLayer(),
  ]);
  return Layer.mergeAll(
    dbLayer,
    Layer.succeed(AuthService)(toAuthSessionProvider(auth)),
    Layer.succeed(RequestHeadersService)(() => getRequestHeaders()),
  );
};

export const makeMiddlewareLayer = async () => {
  const [{ auth }, { getRequestHeaders }] = await Promise.all([
    import("../auth"),
    import("@tanstack/react-start/server"),
  ]);
  return Layer.mergeAll(
    Layer.succeed(AuthService)(toAuthSessionProvider(auth)),
    Layer.succeed(RequestHeadersService)(() => getRequestHeaders()),
    LOG_LAYER,
    TracingLive,
  );
};
