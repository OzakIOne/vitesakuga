import type { Session } from "better-auth";
import type { UserWithTwoFactor } from "better-auth/plugins";
import { Context } from "effect";

export type AuthSessionProvider = {
  api: {
    getSession(args: {
      headers: Headers;
      query: { disableCookieCache: boolean };
    }): Promise<{ session: Session; user: UserWithTwoFactor } | null>;
  };
};

export class AuthService extends Context.Service<
  AuthService,
  AuthSessionProvider
>()("AuthService") {}

export class RequestHeadersService extends Context.Service<
  RequestHeadersService,
  () => Headers
>()("RequestHeadersService") {}

export type AuthServices = AuthService | RequestHeadersService;
