import { redirect } from "@tanstack/react-router";
import { createMiddleware, createServerFn } from "@tanstack/react-start";
import { getRequestHeaders } from "@tanstack/react-start/server";
import { auth } from "src/lib/auth";

// Define the user type based on the session structure
export type AuthUser = {
  id: string;
  createdAt: Date;
  updatedAt: Date;
  email: string;
  emailVerified: boolean;
  name: string;
  image?: string | null;
};

// Export a type for authenticated context
export type AuthenticatedContext = {
  user: AuthUser; // No null here!
};

// Internal helper - only called on server
const getUserInternal = async () => {
  const session = await auth.api.getSession({
    headers: getRequestHeaders(),
    query: {
      disableCookieCache: true,
    },
  });

  if (session?.user) {
    return session.user as AuthUser;
  }
  return null;
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
