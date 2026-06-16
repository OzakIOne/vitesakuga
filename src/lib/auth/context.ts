import type { Session, User } from "better-auth";
import { Context } from "effect";

export type AuthSessionProvider = {
  api: {
    getSession(args: {
      headers: Headers;
      query: { disableCookieCache: boolean };
    }): Promise<{ session: Session; user: User } | null>;
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
