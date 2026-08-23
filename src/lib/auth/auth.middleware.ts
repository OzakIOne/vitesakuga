import { createServerFn } from "@tanstack/react-start";
import { Effect } from "effect";

import { resolveMiddlewareLayer } from "../server-fn.handler";
import type { SessionUser } from "./session.effect";

export const getUserSession = createServerFn().handler(
  async (): Promise<SessionUser> => {
    // Dynamic import keeps the session Effect (server-only module) out of
    // the client bundle: auth.middleware.ts is imported by client routes.
    const [{ SessionService }, layer] = await Promise.all([
      import("./session.effect"),
      resolveMiddlewareLayer(),
    ]);
    return Effect.runPromise(
      Effect.gen(function* () {
        const sessions = yield* SessionService;
        return yield* sessions.getUser();
      }).pipe(Effect.provide(layer)),
    );
  },
);
