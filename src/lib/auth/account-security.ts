import { createServerFn } from "@tanstack/react-start";
import { Context, Effect, Layer } from "effect";

import { KyselyDB } from "../db/context";
import { SqlError } from "../effect/effect.utils";
import { UnauthorizedError } from "../errors";
import { baseLayerFactories, createHandler } from "../server-fn.handler";
import { SessionFetchError, SessionService } from "./session.effect";

export class AccountSecurityService extends Context.Service<
  AccountSecurityService,
  {
    readonly getHasPassword: () => Effect.Effect<
      { hasPassword: boolean },
      UnauthorizedError | SessionFetchError | SqlError,
      SessionService
    >;
  }
>()("AccountSecurityService", {
  make: Effect.gen(function* () {
    const db = yield* KyselyDB;

    const getHasPassword = Effect.fn("AccountSecurityService.getHasPassword")(
      function* () {
        const sessions = yield* SessionService;
        const user = yield* sessions.requireUser("You must be logged in");

        // Mirrors Better Auth's `shouldRequirePassword`: a password is only
        // required when the user has a credential account storing a password
        // (e.g. email/password sign-up). OAuth-only users have none.
        const credentialAccount = yield* db.executeTakeFirstOrUndefined(
          db
            .selectFrom("account")
            .select("password")
            .where("userId", "=", user.id)
            .where("providerId", "=", "credential"),
        );

        return { hasPassword: Boolean(credentialAccount?.password) };
      },
    );

    return { getHasPassword };
  }),
}) {
  static readonly getHasPassword = Effect.fn(
    "AccountSecurityService.getHasPassword",
  )(function* () {
    const svc = yield* AccountSecurityService;
    return yield* svc.getHasPassword();
  });
}

export const AccountSecurityServiceLive = Layer.effect(
  AccountSecurityService,
  AccountSecurityService.make,
);

export const getAccountSecurity = createServerFn().handler(
  createHandler(
    AccountSecurityServiceLive,
    baseLayerFactories.auth,
  )(AccountSecurityService.getHasPassword),
);
