import { Effect, Layer } from "effect";
import { describe, expect, it } from "vitest";

import { ForbiddenError, UnauthorizedError } from "../errors";
import {
  allPolicies,
  anyPolicies,
  getUserRole,
  policy,
  requirePermission,
  requireRole,
  withPolicy,
} from "./policy";
import type { AuthSession } from "./session.effect";
import { SessionService, type SessionUser } from "./session.effect";

const sessionUser = (
  overrides: Partial<Record<string, unknown>> = {},
): Parameters<typeof getUserRole>[0] =>
  ({
    createdAt: new Date(),
    email: "user@test.com",
    emailVerified: true,
    id: "user-1",
    image: null,
    name: "Test User",
    twoFactorEnabled: false,
    updatedAt: new Date(),
    ...overrides,
  }) as Parameters<typeof getUserRole>[0];

// SAFETY: the inline object implements the full SessionService contract; a
// cast keeps the test double readable without stubbing unused plumbing.
const sessionServiceLayer = (
  user: SessionUser | null,
): Layer.Layer<SessionService> => {
  const authSession: AuthSession | null = user
    ? {
        session: {
          createdAt: new Date(),
          expiresAt: new Date(Date.now() + 60_000),
          id: "session-1",
          ipAddress: "127.0.0.1",
          token: "token-1",
          updatedAt: new Date(),
          userAgent: "vitest",
          userId: user.id,
        },
        user,
      }
    : null;
  return Layer.succeed(SessionService, {
    getSession: () => Effect.succeed(authSession),
    getUser: () => Effect.succeed(user),
    requireUser: () =>
      user
        ? Effect.succeed(user)
        : new UnauthorizedError({ message: "not signed in" }),
  }) as unknown as Layer.Layer<SessionService>;
};

/** Builds a policy effect already provided with a session for `role`. */
const asRole =
  (role: string) =>
  <A, E, R>(effect: Effect.Effect<A, E, R>): Effect.Effect<A, E, R> =>
    effect.pipe(Effect.provide(sessionServiceLayer(sessionUser({ role }))));

describe("getUserRole", () => {
  it("reads the rank off the session user", () => {
    expect(getUserRole(sessionUser({ role: "uploader" }))).toBe("uploader");
  });

  it("fails closed to novice when the role is missing or invalid", () => {
    expect(getUserRole(sessionUser())).toBe("novice");
    expect(getUserRole(sessionUser({ role: "superadmin" }))).toBe("novice");
  });
});

describe("requirePermission", () => {
  it("grants novices their own permissions", async () => {
    const result = await asRole("novice")(
      requirePermission("posts:edit-own"),
    ).pipe(Effect.runPromise);
    expect(result).toBeUndefined();
  });

  it("denies novices moderator-only permissions with ForbiddenError", async () => {
    const error = await asRole("novice")(
      requirePermission("posts:edit-any"),
    ).pipe(Effect.flip, Effect.runPromise);
    expect(error).toBeInstanceOf(ForbiddenError);
  });

  it("grants uploaders suggest-edit and moderators edit-any", async () => {
    await expect(
      asRole("uploader")(requirePermission("posts:suggest-edit")).pipe(
        Effect.runPromise,
      ),
    ).resolves.toBeUndefined();
    await expect(
      asRole("moderator")(requirePermission("posts:edit-any")).pipe(
        Effect.runPromise,
      ),
    ).resolves.toBeUndefined();
  });
});

describe("requireRole", () => {
  it("is hierarchical: uploader satisfies an at-least-novice gate", async () => {
    await expect(
      asRole("uploader")(requireRole("novice")).pipe(Effect.runPromise),
    ).resolves.toBeUndefined();
  });

  it("denies moderators admin-only gates", async () => {
    const error = await asRole("moderator")(requireRole("admin")).pipe(
      Effect.flip,
      Effect.runPromise,
    );
    expect(error).toBeInstanceOf(ForbiddenError);
  });
});

describe("policy combinators", () => {
  const ownerId = "someone-else";
  const isOwner = policy((user) => Effect.succeed(user.id === ownerId));

  it("anyPolicies passes when one side holds (owner OR staff)", async () => {
    const guard = anyPolicies([isOwner, requirePermission("posts:edit-any")]);
    await expect(
      asRole("moderator")(guard).pipe(Effect.runPromise),
    ).resolves.toBeUndefined();
  });

  it("anyPolicies fails when both sides deny", async () => {
    const guard = anyPolicies([isOwner, requirePermission("posts:edit-any")]);
    const error = await asRole("novice")(guard).pipe(
      Effect.flip,
      Effect.runPromise,
    );
    expect(error).toBeInstanceOf(ForbiddenError);
  });

  it("allPolicies fails when one side denies even if the other holds", async () => {
    const isSelf = policy((user) => Effect.succeed(user.id === "user-1"));
    const guard = allPolicies(isSelf, requirePermission("posts:edit-any"));
    const error = await asRole("novice")(guard).pipe(
      Effect.flip,
      Effect.runPromise,
    );
    expect(error).toBeInstanceOf(ForbiddenError);
  });
});

describe("withPolicy", () => {
  it("runs the guarded effect when access is granted", async () => {
    const result = await asRole("moderator")(
      Effect.succeed("ran").pipe(
        withPolicy(requirePermission("posts:edit-any")),
      ),
    ).pipe(Effect.runPromise);
    expect(result).toBe("ran");
  });

  it("short-circuits the guarded effect when access is denied", async () => {
    const error = await asRole("novice")(
      Effect.succeed("ran").pipe(
        withPolicy(requirePermission("posts:edit-any")),
      ),
    ).pipe(Effect.flip, Effect.runPromise);
    expect(error).toBeInstanceOf(ForbiddenError);
  });
});

describe("unauthenticated users", () => {
  it("surface UnauthorizedError instead of ForbiddenError", async () => {
    const error = await requirePermission("posts:create")
      .pipe(Effect.provide(sessionServiceLayer(null)), Effect.flip)
      .pipe(Effect.runPromise);
    expect(error).toBeInstanceOf(UnauthorizedError);
  });
});
