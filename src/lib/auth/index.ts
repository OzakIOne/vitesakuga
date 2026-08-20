import { getAuthenticatorName, passkey } from "@better-auth/passkey";
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { captcha, twoFactor } from "better-auth/plugins";
import { tanstackStartCookies } from "better-auth/tanstack-start";
import { Redacted } from "effect";
import { envServer } from "src/lib/env/server";

import { db } from "../db/pool";
import * as schema from "../db/schema";

const passkeyRpID = new URL(envServer.VITE_BASE_URL).hostname;

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
  // socialProviders: {
  //   github: {
  //     clientId: env.GITHUB_CLIENT_ID!,
  //     clientSecret: env.GITHUB_CLIENT_SECRET!,
  //   },
  //   google: {
  //     clientId: env.GOOGLE_CLIENT_ID!,
  //     clientSecret: env.GOOGLE_CLIENT_SECRET!,
  //   },
  // },

  // https://www.better-auth.com/docs/authentication/email-password
  emailAndPassword: {
    enabled: true,
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
    // https://www.better-auth.com/docs/integrations/tanstack#usage-tips
    // https://www.better-auth.com/docs/plugins/2fa
    twoFactor({
      issuer: "ViteSakuga",
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
    deleteUser: {
      enabled: true,
    },
    // changeEmail: {
    //   enabled: true,
    // },
  },
});
