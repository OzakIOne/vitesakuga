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
    deleteUser: {
      enabled: true,
    },
    // changeEmail: {
    //   enabled: true,
    // },
  },
});
