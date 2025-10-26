import { redirect } from "@tanstack/react-router";
import { createMiddleware, createServerFn } from "@tanstack/react-start";
import { getRequestHeaders } from "@tanstack/react-start/server";
import { auth } from "src/lib/auth";

// Internal helper - only called on server
const getUserInternal = async () => {
  const session = await auth.api.getSession({
    headers: getRequestHeaders(),
    query: {
      disableCookieCache: true,
    },
  });

  if (session?.user) {
    return session.user;
  }
  return null;
};

export type MiddlewareUser = {
  user: NonNullable<Awaited<ReturnType<typeof getUserInternal>>>;
};

export const getUserSession = createServerFn().handler(async () => {
  return await getUserInternal();
});

export const authMiddleware = createMiddleware().server(async ({ next }) => {
  const user = await getUserInternal();

  if (!user) {
    throw redirect({ to: "/login" });
  }

  return next({
    context: {
      user,
    },
  });
});
