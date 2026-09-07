// oxlint-disable effecttsgo/async-function -- Better Auth exposes a Promise API; this file is the intentionally small infrastructure boundary
import type { UserWithTwoFactor } from "better-auth/plugins";

import type { AuthSessionProvider } from "./context";

type BetterAuthInstance = typeof import("./index").auth;

/** The only server-side translation point from Better Auth to app auth types. */
export const makeBetterAuthSessionProvider = (
  auth: BetterAuthInstance,
): AuthSessionProvider => ({
  api: {
    getSession: async (args) => {
      const result = await auth.api.getSession({
        headers: args.headers,
        query: args.query,
        asResponse: false,
        returnHeaders: false,
      });
      if (!result) return null;

      // SAFETY: `role` and `username` are required by this app's Better Auth
      // configuration and database schema, while the provider type cannot see
      // those application-specific plugin fields.
      const user = result.user as UserWithTwoFactor & {
        role: string;
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
          twoFactorEnabled: user.twoFactorEnabled ?? false,
          updatedAt: user.updatedAt,
          username: user.username,
        },
      };
    },
  },
});
