import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { tanstackStartCookies } from "better-auth/tanstack-start";
import { envServer } from "src/lib/env/server";
import { db } from "../db/pool";
import * as schema from "../db/schema";

export const auth = betterAuth({
  baseURL: envServer.VITE_BASE_URL,
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

  // https://www.better-auth.com/docs/integrations/tanstack#usage-tips
  plugins: [tanstackStartCookies()],

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
