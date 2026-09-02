import { getAuthenticatorName, passkey } from "@better-auth/passkey";
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { APIError, createAuthMiddleware } from "better-auth/api";
import { captcha, twoFactor, username } from "better-auth/plugins";
import { tanstackStartCookies } from "better-auth/tanstack-start";
import { Option, Redacted, Schema } from "effect";
import { envServer } from "src/lib/env/server";

import { db } from "../db/pool";
import * as schema from "../db/schema";
import { USERNAME_MAX_LENGTH } from "../mentions/mentions";
import { assessPassword, MIN_PASSWORD_LENGTH } from "./password-policy";
import { generateUsername } from "./username.server";

const passkeyRpID = new URL(envServer.VITE_BASE_URL).hostname;
const githubClientSecret = Redacted.value(envServer.GITHUB_CLIENT_SECRET);
const googleClientSecret = Redacted.value(envServer.GOOGLE_CLIENT_SECRET);
// Social providers are only registered when their credentials are actually
// set, so a fresh clone with empty env vars still boots (the corresponding
// button then gets a "provider not found" error instead of crashing the
// server).
type SocialProviderEntry = {
  clientId: string;
  clientSecret: string;
};
const socialProviders: Partial<
  Record<"github" | "google", SocialProviderEntry>
> = {};
if (envServer.GITHUB_CLIENT_ID && githubClientSecret) {
  socialProviders.github = {
    clientId: envServer.GITHUB_CLIENT_ID,
    clientSecret: githubClientSecret,
  };
}
if (envServer.GOOGLE_CLIENT_ID && googleClientSecret) {
  socialProviders.google = {
    clientId: envServer.GOOGLE_CLIENT_ID,
    clientSecret: googleClientSecret,
  };
}

// Every endpoint whose body carries a new plaintext password. Better Auth's
// `minPasswordLength` enforces the length floor on all of them; the strength
// rules are added by the `hooks.before` middleware below.
const PASSWORD_SET_PATHS = new Set([
  "/change-password",
  "/reset-password",
  "/sign-up/email",
]);

// Shape of the two Better Auth endpoints that accept a new password:
// sign-up uses `password`, change/reset use `newPassword`.
const NewPasswordBody = Schema.Union([
  Schema.Struct({ password: Schema.String }),
  Schema.Struct({ newPassword: Schema.String }),
]);

export const auth = betterAuth({
  baseURL: envServer.VITE_BASE_URL,
  secret: Redacted.value(envServer.BETTER_AUTH_SECRET),
  database: drizzleAdapter(db, {
    provider: "pg",
    schema: {
      ...schema,
    },
  }),

  // https://www.better-auth.com/docs/concepts/oauth
  socialProviders,

  // https://www.better-auth.com/docs/authentication/email-password
  emailAndPassword: {
    enabled: true,
    // Server-side floor for sign-up, password change and password reset.
    // Strength (character-class) rules live in hooks.before below.
    minPasswordLength: MIN_PASSWORD_LENGTH,
  },

  // https://www.better-auth.com/docs/concepts/database
  // Generates the @mention handle for users who never pick one (social
  // sign-ups); the username plugin normalizes and validates it afterwards.
  databaseHooks: {
    user: {
      create: {
        before: async (createdUser) => {
          if (createdUser["username"]) {
            return;
          }
          return {
            data: {
              ...createdUser,
              username: await generateUsername(createdUser.name),
            },
          };
        },
      },
    },
  },

  // https://www.better-auth.com/docs/concepts/hooks
  // Server-side password-strength enforcement on every endpoint that sets a
  // new password. The client schema mirrors this (auth.schemas.ts), but the
  // check must not trust the client: this hook is the actual gate.
  hooks: {
    before: createAuthMiddleware(async (ctx) => {
      if (!PASSWORD_SET_PATHS.has(ctx.path)) {
        return;
      }
      // Parse the request here instead of runtime-narrowing `ctx.body`;
      // requests that don't carry a new password fall through untouched.
      const candidate = Schema.decodeUnknownOption(NewPasswordBody)(
        ctx.body,
      ).pipe(
        Option.map((body) =>
          "password" in body ? body.password : body.newPassword,
        ),
      );
      if (Option.isNone(candidate)) {
        return;
      }
      const assessment = assessPassword(candidate.value);
      if (!assessment.ok) {
        throw new APIError("BAD_REQUEST", { message: assessment.reason });
      }
    }),
  },

  // https://www.better-auth.com/docs/concepts/rate-limit
  // Per-path request limits, enforced via an atomic read-and-increment against
  // the `rateLimit` table (Postgres/Neon). Database storage is globally
  // consistent across Cloudflare Worker isolates — in-memory storage would be
  // local to a single isolate and trivially bypassable at scale.
  rateLimit: {
    enabled: true,
    window: 60,
    max: 100,
    storage: "database",
    modelName: "rateLimit",
    customRules: {
      // Brute-force / credential-stuffing guards on the auth entry points.
      "/sign-in/email": { window: 60, max: 10 },
      "/sign-up/email": { window: 3600, max: 10 },
      "/request-password-reset": { window: 3600, max: 5 },
      "/forget-password": { window: 3600, max: 5 },
      "/email-otp/send-verification-otp": { window: 60, max: 5 },
      "/two-factor/verify": { window: 60, max: 5 },
    },
  },

  // https://www.better-auth.com/docs/plugins/captcha
  // Invisible Cloudflare Turnstile challenge on the email auth endpoints. The
  // client renders the widget (sitekey) and forwards the token in the
  // `x-captcha-response` header; the server verifies it with the secret.
  plugins: [
    // Gated to production WITH a configured secret: Turnstile siteverify can't
    // pass against a localhost origin, so enabling it in dev would block every
    // sign-in, and enabling it without a secret would break production auth.
    // Only activates once TURNSTILE_SECRET is set (provisioned via alchemy).
    ...(envServer.NODE_ENV === "production" &&
    Redacted.value(envServer.TURNSTILE_SECRET).length > 0
      ? [
          captcha({
            provider: "cloudflare-turnstile",
            secretKey: Redacted.value(envServer.TURNSTILE_SECRET),
          }),
        ]
      : []),
    // https://www.better-auth.com/docs/plugins/username
    // Unique @mention handle on `user.username` (src/lib/db/schema/auth.schema.ts).
    // Lowercase `[a-z0-9_]` only (dots would complicate mention parsing);
    // validated after normalization, so `@Jane` mention text matches the
    // stored `jane`. No separate displayUsername column — the display name
    // (`user.name`) already handles presentation.
    username({
      displayUsername: false,
      maxUsernameLength: USERNAME_MAX_LENGTH,
      usernameValidator: (value) => /^[a-z0-9_]+$/.test(value),
      validationOrder: {
        username: "post-normalization",
      },
    }),
    // https://www.better-auth.com/docs/integrations/tanstack#usage-tips
    // https://www.better-auth.com/docs/plugins/2fa
    twoFactor({
      issuer: "ViteSakuga",
      // OAuth-only users (GitHub/Google) have no credential account, so they
      // can't provide a password when enabling, disabling or regenerating 2FA.
      // With this flag, Better Auth only asks for a password when the user
      // actually has a credential account.
      allowPasswordless: true,
    }),
    passkey({
      rpID: passkeyRpID,
      rpName: "ViteSakuga",
      origin: envServer.VITE_BASE_URL,
      registration: {
        afterVerification: async ({ verification }) => {
          const name = getAuthenticatorName(
            verification.registrationInfo?.aaguid,
          );
          return name ? { name } : {};
        },
      },
    }),
    // https://www.better-auth.com/docs/plugins/dash
    // TODO: `dash` is the Better Auth Infrastructure plugin from
    // `@better-auth/infra`, which is not installed in this project yet.
    // Re-enable once the dependency and its API key config are provisioned.
    // dash(dashOptions),
    // Cookie integration must come last so `Set-Cookie` headers from the
    // plugins above (2FA challenge, passkey sessions) are forwarded to the
    // TanStack Start cookie store.
    tanstackStartCookies(),
  ],

  // https://www.better-auth.com/docs/concepts/session-management#session-caching
  session: {
    cookieCache: {
      enabled: true,
      maxAge: 5 * 60, // 5 minutes
    },
  },

  user: {
    // `role` backs the authorization policies in `src/lib/auth/policy.ts`.
    // It is server-managed only (`input: false`): users can never set or
    // change their rank through a Better Auth endpoint, promotions go
    // through the points system and staff review instead. The column lives
    // on `user` in `src/lib/db/schema/auth.schema.ts` with a DB-level
    // default of "novice".
    additionalFields: {
      role: { type: "string", defaultValue: "novice", input: false },
    },
    // Account deletion is NOT handled by Better Auth's built-in
    // `deleteUser` endpoint: it would hard-delete the `user` row and fail
    // on the posts/comments foreign keys, leaking nothing but errors.
    // Deletion goes through the custom anonymizing server function in
    // `src/lib/auth/delete-account.ts` instead.
    // changeEmail: {
    //   enabled: true,
    // },
  },
});
