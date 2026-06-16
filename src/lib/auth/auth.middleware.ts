import { createServerFn } from "@tanstack/react-start";
import type { User } from "better-auth";
import { Data, Effect } from "effect";

import { AuthService, RequestHeadersService } from "../auth/context";
import { resolveMiddlewareLayer } from "../server-fn.handler";

export class SessionFetchError extends Data.TaggedError("SessionFetchError")<{
  readonly message: string;
  readonly cause: unknown;
}> {}

export const getSessionEffect = Effect.fn("getSession")(function* () {
  const authSvc = yield* AuthService;
  const getHeaders = yield* RequestHeadersService;

  const headers = getHeaders();
  const cookie = headers.get("cookie") ?? "";

  if (
    process.env.NODE_ENV !== "production" &&
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

export const getUserSession = createServerFn().handler(
  async (): Promise<User | null> => {
    const layer = await resolveMiddlewareLayer();
    return Effect.runPromise(
      getUserSessionEffect().pipe(Effect.provide(layer)),
    );
  },
);
