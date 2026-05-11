import { Context } from "effect";

export type AuthSessionProvider = {
  api: {
    getSession(args: {
      headers: Headers;
      query: { disableCookieCache: boolean };
    }): Promise<{ user: { id: string } | null } | null>;
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
