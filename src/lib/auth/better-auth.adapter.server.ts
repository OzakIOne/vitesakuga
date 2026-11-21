// oxlint-disable effecttsgo/async-function -- Better Auth exposes a Promise API; this file is the intentionally small infrastructure boundary
import type { UserWithTwoFactor } from "better-auth/plugins";
import { DateTime, Effect } from "effect";

import { AuthProviderError, type AuthService } from "./context";
import type { AuthSession } from "./types";

type BetterAuthInstance = typeof import("./instance").auth;

const E2E_BYPASS_COOKIE_PATTERN = /(?:^|;\s*)e2e-test-auth=([^;\s]+)/;

const E2E_BYPASS_USERS = {
  bypass: {
    email: "e2e@test.local",
    id: "e2e-test-user",
    name: "E2E Test User",
    username: "e2e_test_user",
  },
  "bypass-oauth": {
    email: "e2e-oauth@test.local",
    id: "e2e-oauth-user",
    name: "E2E OAuth User",
    username: "e2e_oauth_user",
  },
} as const;

const fetchBetterAuthSession = async (
  auth: BetterAuthInstance,
  args: {
    readonly headers: Headers;
    readonly query: { readonly disableCookieCache: boolean };
  },
): Promise<AuthSession | null> => {
  const result = await auth.api.getSession({
    headers: args.headers,
    query: args.query,
    asResponse: false,
    returnHeaders: false,
  });
  if (!result) return null;

  // SAFETY: `role`, `username` and the suspension fields are required by
  // this app's Better Auth configuration and database schema, while the
  // provider type cannot see those application-specific plugin fields.
  const user = result.user as UserWithTwoFactor & {
    role: string;
    suspendedAt: Date | null;
    suspendedReason: string | null;
    username: string;
  };
  return {
    session: {
      createdAt: result.session.createdAt,
      expiresAt: result.session.expiresAt,
      id: result.session.id,
      ipAddress: result.session.ipAddress ?? null,
      token: result.session.token,
      updatedAt: result.session.updatedAt,
      userAgent: result.session.userAgent ?? null,
      userId: result.session.userId,
    },
    user: {
      createdAt: user.createdAt,
      email: user.email,
      emailVerified: user.emailVerified,
      id: user.id,
      image: user.image ?? null,
      name: user.name,
      role: user.role,
      suspendedAt: user.suspendedAt ?? null,
      suspendedReason: user.suspendedReason ?? null,
      twoFactorEnabled: user.twoFactorEnabled ?? false,
      updatedAt: user.updatedAt,
      username: user.username,
    },
  };
};

/** The only server-side translation point from Better Auth to app auth types. */
export const makeBetterAuthService = (
  auth: BetterAuthInstance,
): AuthService["Service"] => ({
  getSession: (args) =>
    Effect.tryPromise({
      try: () => fetchBetterAuthSession(auth, args),
      catch: (cause) =>
        new AuthProviderError({
          cause,
          message: "Authentication provider failed to retrieve the session",
        }),
    }),
});

/**
 * E2E session adapter that honors the `e2e-test-auth` bypass cookie when
 * running outside production, falling back to Better Auth otherwise.
 */
export const makeE2EAuthService = (
  fallback: AuthService["Service"],
): AuthService["Service"] => ({
  getSession: (args) =>
    Effect.gen(function* () {
      const cookie = args.headers.get("cookie") ?? "";
      const bypassValue = E2E_BYPASS_COOKIE_PATTERN.exec(cookie)?.[1];
      const bypassUser =
        bypassValue === "bypass" || bypassValue === "bypass-oauth"
          ? E2E_BYPASS_USERS[bypassValue]
          : undefined;

      if (import.meta.env.MODE !== "production" && bypassUser !== undefined) {
        const now = yield* DateTime.now;
        const expiresAt = DateTime.add(now, { days: 1 });
        return {
          session: {
            createdAt: DateTime.toDate(now),
            expiresAt: DateTime.toDate(expiresAt),
            id: "e2e-session",
            ipAddress: "127.0.0.1",
            token: "e2e-token",
            updatedAt: DateTime.toDate(now),
            userAgent: "e2e-test",
            userId: bypassUser.id,
          },
          user: {
            createdAt: DateTime.toDate(now),
            email: bypassUser.email,
            emailVerified: true,
            id: bypassUser.id,
            image: null,
            name: bypassUser.name,
            role: "admin",
            suspendedAt: null,
            suspendedReason: null,
            twoFactorEnabled: false,
            updatedAt: DateTime.toDate(now),
            username: bypassUser.username,
          },
        };
      }

      return yield* fallback.getSession(args);
    }),
});
