import { Context, Effect, Schema } from "effect";

import type { AuthSession } from "./types";

export type AuthSessionLookupArgs = {
  readonly headers: Headers;
  readonly query: { readonly disableCookieCache: boolean };
};

export type AuthSessionLookupFn = (
  args: AuthSessionLookupArgs,
) => Promise<AuthSession | null>;

export class AuthProviderError extends Schema.TaggedError<AuthProviderError>()(
  "AuthProviderError",
  { cause: Schema.Unknown, message: Schema.String },
) {}

/** Provider-independent Effect port for authentication. */
export class AuthService extends Context.Service<
  AuthService,
  {
    readonly getSession: (
      args: AuthSessionLookupArgs,
    ) => Effect.Effect<AuthSession | null, AuthProviderError>;
  }
>()("AuthService") {}

export class RequestHeadersService extends Context.Service<
  RequestHeadersService,
  () => Headers
>()("RequestHeadersService") {}
