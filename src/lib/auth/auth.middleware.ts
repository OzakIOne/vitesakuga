import { redirect } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { getRequestHeaders } from "@tanstack/react-start/server";
import { Effect } from "effect";
import { auth } from "src/lib/auth";

import { Debug, withMinimumLogLevel } from "../effect/logger";

export const getUserSession = createServerFn().handler(() =>
  Effect.runPromise(
    Effect.fn("getUserSession")(
      function* () {
        const session = yield* Effect.tryPromise({
          try: () =>
            auth.api.getSession({
              headers: getRequestHeaders(),
              query: { disableCookieCache: true },
            }),
          catch: (error) => new Error(`Session check failed: ${String(error)}`),
        });

        return session?.user ?? null;
      },
      Effect.provide(withMinimumLogLevel(Debug)),
    )(),
  ),
);

export const requireAuth = createServerFn().handler(() =>
  Effect.runPromise(
    Effect.fn("requireAuth")(
      function* () {
        const headers = getRequestHeaders();
        const cookie = headers.get("cookie") ?? "";

        // E2E test bypass — set cookie `e2e-test-auth=bypass` in Playwright
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
            auth.api.getSession({
              headers,
              query: { disableCookieCache: true },
            }),
          catch: (error) => new Error(`Session check failed: ${String(error)}`),
        });

        if (!session?.user) {
          throw redirect({ to: "/login" });
        }

        return session.user;
      },
      Effect.provide(withMinimumLogLevel(Debug)),
    )(),
  ),
);
