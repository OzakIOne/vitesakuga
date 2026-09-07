import { Context, Effect, Schema } from "effect";

import type { AuthSession } from "./types";

/** Temporary provider shape used only at an infrastructure adapter boundary. */
export type AuthSessionProvider = {
  api: {
    getSession(args: {
      headers: Headers;
      query: { disableCookieCache: boolean };
    }): Promise<AuthSession | null>;
  };
};

export class AuthProviderError extends Schema.TaggedError<AuthProviderError>()(
  "AuthProviderError",
  { cause: Schema.Unknown, message: Schema.String },
) {}

/** Provider-independent Effect port for authentication. */
export class AuthService extends Context.Service<
  AuthService,
  {
    readonly getSession: (args: {
      readonly headers: Headers;
      readonly query: { readonly disableCookieCache: boolean };
    }) => Effect.Effect<AuthSession | null, AuthProviderError>;
  }
>()("AuthService") {}

export const makeAuthService = (
  provider: AuthSessionProvider,
): AuthService["Service"] => ({
  getSession: (args) =>
    Effect.tryPromise({
      try: () => provider.api.getSession(args),
      catch: (cause) =>
        new AuthProviderError({
          cause,
          message: "Authentication provider failed to retrieve the session",
        }),
    }),
});

export class RequestHeadersService extends Context.Service<
  RequestHeadersService,
  () => Headers
>()("RequestHeadersService") {}
