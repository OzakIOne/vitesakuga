import { createServerFn } from "@tanstack/react-start";
import { Effect } from "effect";

import { resolveMiddlewareLayer } from "../server-fn.handler";
import type { UserCapabilities } from "./capabilities";
import type { SessionUser } from "./session.effect";

export const getUserSessionContext = createServerFn().handler(
  // oxlint-disable-next-line effecttsgo/async-function -- TanStack Start server-fn handlers must return a Promise (RPC serialization boundary); the dynamic import of the server-only session module happens outside the Effect, so the async signature cannot be replaced with Effect.gen
  async (): Promise<{
    readonly user: SessionUser;
    readonly capabilities: UserCapabilities;
  }> => {
    // Dynamic import keeps the session Effect (server-only module) out of
    // the client bundle: auth.middleware.ts is imported by client routes.
    const [{ SessionService }, layer] = await Promise.all([
      import("./session.effect"),
      resolveMiddlewareLayer(),
    ]);
    return Effect.runPromise(
      Effect.gen(function* () {
        const sessions = yield* SessionService;
        return yield* sessions.getClientSession();
      }).pipe(Effect.provide(layer)),
    );
  },
);
