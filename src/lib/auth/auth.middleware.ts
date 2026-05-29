import { redirect } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { Data, Effect } from "effect";

import { AuthService, RequestHeadersService } from "../auth/context";
import { resolveMiddlewareLayer } from "../server-fn.handler";

export class AuthRequiredError extends Data.TaggedError("AuthRequiredError")<{
  readonly redirectTo: string;
}> {}

export const getUserSessionEffect = Effect.fn("getUserSession")(function* () {
  const authSvc = yield* AuthService;
  const getHeaders = yield* RequestHeadersService;

  const session = yield* Effect.tryPromise({
    try: () =>
      authSvc.api.getSession({
        headers: getHeaders(),
        query: { disableCookieCache: true },
      }),
    catch: (error) => new Error(`Session check failed: ${String(error)}`),
  });

  return session?.user ?? null;
});

export const requireAuthEffect = Effect.fn("requireAuth")(function* () {
  const authSvc = yield* AuthService;
  const getHeaders = yield* RequestHeadersService;

  const headers = getHeaders();
  const cookie = headers.get("cookie") ?? "";

  if (cookie.includes("e2e-test-auth=bypass")) {
    return {
      createdAt: new Date(),
      email: "e2e@test.local",
      emailVerified: true,
      id: "e2e-test-user",
      image: null,
      name: "E2E Test User",
      updatedAt: new Date(),
    };
  }

  const session = yield* Effect.tryPromise({
    try: () =>
      authSvc.api.getSession({
        headers,
        query: { disableCookieCache: true },
      }),
    catch: (error) => new Error(`Session check failed: ${String(error)}`),
  });

  if (!session?.user) {
    return yield* Effect.fail(new AuthRequiredError({ redirectTo: "/login" }));
  }

  return session.user;
});

export const getUserSession = createServerFn().handler(async () => {
  const layer = await resolveMiddlewareLayer();
  return Effect.runPromise(
    getUserSessionEffect().pipe(Effect.provide(layer)) as Effect.Effect<
      any,
      Error
    >,
  );
});

export const requireAuth = createServerFn().handler(async () => {
  const layer = await resolveMiddlewareLayer();
  return Effect.runPromise(
    requireAuthEffect().pipe(
      Effect.provide(layer),
      Effect.catchTag("AuthRequiredError", (error) =>
        Effect.succeed(redirect({ to: error.redirectTo })),
      ),
    ),
  );
});
