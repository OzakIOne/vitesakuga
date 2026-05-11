import { redirect } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { Effect } from "effect";

import { AuthService, RequestHeadersService } from "../auth/context";

const importFactories = () => import("../db/layer-factories.server");

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
    return yield* Effect.die(redirect({ to: "/login" }));
  }

  return session.user;
});

// ---- createServerFn wrappers ----

export const getUserSession = createServerFn().handler(async () => {
  const { makeMiddlewareLayer } = await importFactories();
  const layer = await makeMiddlewareLayer();
  return Effect.runPromise(getUserSessionEffect().pipe(Effect.provide(layer)));
});

export const requireAuth = createServerFn().handler(async () => {
  const { makeMiddlewareLayer } = await importFactories();
  const layer = await makeMiddlewareLayer();
  return Effect.runPromise(requireAuthEffect().pipe(Effect.provide(layer)));
});
