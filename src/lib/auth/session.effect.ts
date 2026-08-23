import type { Session } from "better-auth";
import type { UserWithTwoFactor } from "better-auth/plugins";
import { Config, Context, DateTime, Effect, Layer, Schema } from "effect";

import { UnauthorizedError } from "../errors";
import { AuthService, RequestHeadersService } from "./context";

export class SessionFetchError extends Schema.TaggedError<SessionFetchError>()(
  "SessionFetchError",
  {
    message: Schema.String,
    cause: Schema.Unknown,
  },
) {}

export type AuthSession = {
  session: Session;
  user: UserWithTwoFactor;
};

export type SessionUser = UserWithTwoFactor | null;

/**
 * Access to the current request's Better Auth session.
 *
 * The single entry point for authentication state: every service reads the
 * session through this service instead of importing free functions, so the
 * dependency shows up in the Effect requirement channel and can be swapped
 * wholesale in tests via `SessionServiceLive`.
 */
export class SessionService extends Context.Service<
  SessionService,
  {
    /** Full Better Auth session, or null when signed out. */
    readonly getSession: () => Effect.Effect<
      AuthSession | null,
      SessionFetchError
    >;

    /**
     * Current user, or null when signed out. For endpoints that legitimately
     * serve anonymous visitors; prefer `requireUser` when signing in is
     * mandatory.
     */
    readonly getUser: () => Effect.Effect<SessionUser, SessionFetchError>;

    /**
     * Current user of a signed-in request; fails with `UnauthorizedError`
     * otherwise. The message is required because it reaches clients verbatim
     * through error toasts.
     */
    readonly requireUser: (
      message: string,
    ) => Effect.Effect<
      UserWithTwoFactor,
      UnauthorizedError | SessionFetchError
    >;
  }
>()("SessionService", {
  make: Effect.gen(function* () {
    const authSvc = yield* AuthService;
    const getHeaders = yield* RequestHeadersService;

    const getSession = Effect.fn("SessionService.getSession")(function* () {
      const headers = getHeaders();
      const cookie = headers.get("cookie") ?? "";

      // import.meta.env.MODE is statically replaced by Vite, so it is safe on
      // both client and server; this module is server-only. The e2e bypass is
      // additionally gated on DATABASE_DRIVER === "e2e" (only set by the
      // Playwright webServer in e2e/playwright.config.ts). Deployed workers
      // never set that var, and NODE_ENV defaults to "production" there
      // (infra/alchemy.run.ts), so the bypass can never activate outside e2e —
      // even for dev-mode builds that report MODE=development.
      const databaseDriver = yield* Config.string("DATABASE_DRIVER").pipe(
        Effect.orElseSucceed(() => ""),
      );
      const nodeEnv = yield* Config.string("NODE_ENV").pipe(
        Effect.orElseSucceed(() => ""),
      );
      const isE2E = databaseDriver === "e2e" && nodeEnv !== "production";

      if (
        import.meta.env.MODE !== "production" &&
        isE2E &&
        cookie.includes("e2e-test-auth=bypass")
      ) {
        const now = yield* DateTime.now;
        const expiresAt = DateTime.add(now, { days: 1 });
        return {
          session: {
            createdAt: DateTime.toDate(now),
            expiresAt: DateTime.toDate(expiresAt),
            id: "e2e-session",
            ipAddress: "127.0.0.1",
            token: "e2e-token",
            updatedAt: DateTime.toDate(now),
            userAgent: "e2e-test",
            userId: "e2e-test-user",
          },
          user: {
            createdAt: DateTime.toDate(now),
            email: "e2e@test.local",
            emailVerified: true,
            id: "e2e-test-user",
            image: null,
            name: "E2E Test User",
            twoFactorEnabled: false,
            updatedAt: DateTime.toDate(now),
          },
        };
      }

      const session = yield* Effect.tryPromise({
        try: () =>
          authSvc.api.getSession({
            headers,
            query: { disableCookieCache: true },
          }),
        catch: (error) =>
          new SessionFetchError({
            message: "Failed to get session",
            cause: error,
          }),
      });

      if (session?.user) {
        yield* Effect.logInfo("Session retrieved").pipe(
          Effect.annotateLogs("userId", session.user.id),
        );
      }

      return session;
    });

    const getUser = Effect.fn("SessionService.getUser")(function* () {
      const session = yield* getSession();
      return session?.user ?? null;
    });

    const requireUser = Effect.fn("SessionService.requireUser")(function* (
      message: string,
    ) {
      const session = yield* getSession();

      if (!session?.user) {
        return yield* new UnauthorizedError({ message });
      }

      return session.user;
    });

    return { getSession, getUser, requireUser };
  }),
}) {}

export const SessionServiceLive = Layer.effect(
  SessionService,
  SessionService.make,
);
