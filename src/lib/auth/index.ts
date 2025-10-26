import { betterAuth } from "better-auth";
import { reactStartCookies } from "better-auth/react-start";
// import { env } from "~/env/server";
// import { db } from "~/auth/db";
import { getPoolSingleton } from "../db/pool";

export const auth = betterAuth({
  baseURL: process.env.VITE_BASE_URL,
  database: getPoolSingleton(),

  // https://www.better-auth.com/docs/integrations/tanstack#usage-tips
  plugins: [reactStartCookies()],

  // https://www.better-auth.com/docs/concepts/session-management#session-caching
  session: {
    cookieCache: {
      enabled: true,
      maxAge: 5 * 60, // 5 minutes
    },
  },

  // https://www.better-auth.com/docs/concepts/oauth
  // socialProviders: {
  //   github: {
  //     clientId: process.env.GITHUB_CLIENT_ID!,
  //     clientSecret: process.env.GITHUB_CLIENT_SECRET!,
  //   },
  //   google: {
  //     clientId: process.env.GOOGLE_CLIENT_ID!,
  //     clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
  //   },
  // },

  // https://www.better-auth.com/docs/authentication/email-password
  emailAndPassword: {
    enabled: true,
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
