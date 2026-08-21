import type { UserWithTwoFactor } from "better-auth/plugins";
import { Effect, Schema } from "effect";

import { AuthService, RequestHeadersService } from "./context";

export class SessionFetchError extends Schema.TaggedError<SessionFetchError>()(
  "SessionFetchError",
  {
    message: Schema.String,
    cause: Schema.Unknown,
  },
) {}

export const getSessionEffect = Effect.fn("getSession")(function* () {
  const authSvc = yield* AuthService;
  const getHeaders = yield* RequestHeadersService;

  const headers = getHeaders();
  const cookie = headers.get("cookie") ?? "";

  // import.meta.env.MODE is statically replaced by Vite, so it is safe on
  // both client and server; this module is server-only. The e2e bypass is
  // additionally gated on process.env.DATABASE_DRIVER === "pglite" (only set
  // by the Playwright webServer in e2e/playwright.config.ts). Deployed
  // workers never set that var, and NODE_ENV defaults to "production" there
  // (infra/alchemy.run.ts), so the bypass can never activate outside e2e —
  // even for dev-mode builds that report MODE=development.
  const isE2E =
    process.env["DATABASE_DRIVER"] === "pglite" &&
    process.env["NODE_ENV"] !== "production";

  if (
    import.meta.env.MODE !== "production" &&
    isE2E &&
    cookie.includes("e2e-test-auth=bypass")
  ) {
    return {
      session: {
        createdAt: new Date(),
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
        id: "e2e-session",
        ipAddress: "127.0.0.1",
        token: "e2e-token",
        updatedAt: new Date(),
        userAgent: "e2e-test",
        userId: "e2e-test-user",
      },
      user: {
        createdAt: new Date(),
        email: "e2e@test.local",
        emailVerified: true,
        id: "e2e-test-user",
        image: null,
        name: "E2E Test User",
        twoFactorEnabled: false,
        updatedAt: new Date(),
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
      new SessionFetchError({ message: "Failed to get session", cause: error }),
  });

  if (session?.user) {
    yield* Effect.logInfo("Session retrieved").pipe(
      Effect.annotateLogs("userId", session.user.id),
    );
  }

  return session;
});

export const getUserSessionEffect = Effect.fn("getUserSession")(function* () {
  const session = yield* getSessionEffect();
  return session?.user ?? null;
});

export type SessionUser = UserWithTwoFactor | null;
