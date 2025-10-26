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
const getUserSessionInternal = async () => {
  const session = await auth.api.getSession({
    headers: getRequestHeaders(),
    query: {
      disableCookieCache: true,
    },
  });

  if (session?.user) {
    return { user: session.user as AuthUser };
  }
  return null;
};

export const getUserSession = createServerFn().handler(async () => {
  return await getUserSessionInternal();
});

export const authMiddleware = createMiddleware().server(async ({ next }) => {
  const session = await getUserSessionInternal();

  if (!session) {
    throw redirect({ to: "/login" });
  }

  return next({
    context: {
      user: session.user,
    },
  });
});
