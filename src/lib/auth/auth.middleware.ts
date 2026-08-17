import { createServerFn } from "@tanstack/react-start";
import { Effect } from "effect";

import type { SessionUser } from "./session.effect";
import { resolveMiddlewareLayer } from "../server-fn.handler";

export const getUserSession = createServerFn().handler(
  async (): Promise<SessionUser> => {
    // Dynamic import keeps the session Effect (server-only module) out of
    // the client bundle: auth.middleware.ts is imported by client routes.
    const [{ getUserSessionEffect }, layer] = await Promise.all([
      import("./session.effect"),
      resolveMiddlewareLayer(),
    ]);
    return Effect.runPromise(
      getUserSessionEffect().pipe(Effect.provide(layer)),
    );
  },
);
