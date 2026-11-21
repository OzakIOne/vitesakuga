import { Effect, Layer } from "effect";
import { beforeEach, describe, expect, it, vi, type Mock } from "vitest";

import {
  AuthProviderError,
  AuthService,
  RequestHeadersService,
  type AuthSessionLookupFn,
} from "../auth/context";
import { makeE2EAuthService } from "./better-auth.adapter.server";
import { PERMISSION_CATALOG } from "./capabilities";
import { authorize } from "./policy";
import { SessionService, SessionServiceLive } from "./session.effect";
import type { AuthorizedActor } from "./session.effect";
import { makeAuthSession, makeSessionUser } from "./session.fixture";

let mockGetSession: Mock<AuthSessionLookupFn>;
let mockGetHeaders: Mock<() => Headers>;

let testLayer: Layer.Layer<SessionService>;

beforeEach(() => {
  mockGetSession = vi.fn<AuthSessionLookupFn>();
  mockGetHeaders = vi.fn(() => new Headers());

  testLayer = SessionServiceLive.pipe(
    Layer.provide(
      Layer.mergeAll(
        Layer.succeed(AuthService)({
          getSession: (args) =>
            Effect.tryPromise({
              try: () => mockGetSession(args),
              catch: (cause) =>
                new AuthProviderError({
                  cause,
                  message:
                    "Authentication provider failed to retrieve the session",
                }),
            }),
        }),
        Layer.succeed(RequestHeadersService)(mockGetHeaders),
      ),
    ),
  );
});

const getSessionProgram = Effect.gen(function* () {
  const sessions = yield* SessionService;
  return yield* sessions.getSession();
});

const getUserProgram = Effect.gen(function* () {
  const sessions = yield* SessionService;
  return yield* sessions.getUser();
});

const getClientSessionProgram = Effect.gen(function* () {
  const sessions = yield* SessionService;
  return yield* sessions.getClientSession();
});

const requireUserProgram = Effect.gen(function* () {
  const sessions = yield* SessionService;
  return yield* sessions.requireUser("You must be logged in to vote");
});

const requireActorProgram = Effect.gen(function* () {
  const sessions = yield* SessionService;
  return yield* sessions.requireActor("You must be logged in to vote");
});

describe("SessionService.getClientSession", () => {
  it.each(["novice", "uploader", "moderator", "admin"] as const)(
    "returns the permissions authorize grants for %s",
    async (role) => {
      const session = makeAuthSession({ id: `${role}-1`, role });
      mockGetSession.mockResolvedValueOnce(session);

      const result = await Effect.runPromise(
        Effect.provide(getClientSessionProgram, testLayer),
      );
      const actor: AuthorizedActor = {
        id: session.user.id,
        role,
        signedInAt: session.session.createdAt,
      };

      expect(result.user).toEqual(session.user);
      expect(mockGetSession).toHaveBeenCalledTimes(1);
      expect(result.capabilities.hasMutationActor).toBe(true);
      expect(result.capabilities.suspended).toBe(false);
      for (const permission of PERMISSION_CATALOG) {
        const authorized = await Effect.runPromise(
          authorize({ actor, permission }).pipe(
            Effect.match({ onFailure: () => false, onSuccess: () => true }),
          ),
        );
        expect(result.capabilities.permissions.includes(permission)).toBe(
          authorized,
        );
      }
    },
  );

  it("returns no permissions for a suspended user and keeps the reason", async () => {
    mockGetSession.mockResolvedValueOnce(
      makeAuthSession({
        id: "suspended-1",
        suspendedAt: new Date("2026-10-31T09:00:00.000Z"),
        suspendedReason: "Spam",
      }),
    );

    const result = await Effect.runPromise(
      Effect.provide(getClientSessionProgram, testLayer),
    );

    expect(result.capabilities).toEqual({
      actorId: "suspended-1",
      hasMutationActor: false,
      permissions: [],
      suspended: true,
      suspensionReason: "Spam",
    });
  });

  it("returns no permissions for an unrecognized role", async () => {
    mockGetSession.mockResolvedValueOnce(
      makeAuthSession({ id: "unknown-1", role: "unrecognized" }),
    );

    const result = await Effect.runPromise(
      Effect.provide(getClientSessionProgram, testLayer),
    );

    expect(result.capabilities).toEqual({
      actorId: "unknown-1",
      hasMutationActor: false,
      permissions: [],
      suspended: false,
      suspensionReason: null,
    });
  });

  it("returns no permissions when signed out", async () => {
    mockGetSession.mockResolvedValueOnce(null);

    const result = await Effect.runPromise(
      Effect.provide(getClientSessionProgram, testLayer),
    );

    expect(result).toEqual({
      capabilities: {
        actorId: null,
        hasMutationActor: false,
        permissions: [],
        suspended: false,
        suspensionReason: null,
      },
      user: null,
    });
  });
});

describe("SessionService.getUser", () => {
  it("returns user when session exists", async () => {
    mockGetSession.mockResolvedValueOnce(makeAuthSession({ id: "user-1" }));
    const result = await Effect.runPromise(
      Effect.provide(getUserProgram, testLayer),
    );
    expect(result).toEqual(makeSessionUser({ id: "user-1" }));
  });

  it("returns null when no session", async () => {
    mockGetSession.mockResolvedValueOnce(null);
    const result = await Effect.runPromise(
      Effect.provide(getUserProgram, testLayer),
    );
    expect(result).toBeNull();
  });

  it("returns null when session has no user", async () => {
    // SAFETY: deliberately malformed provider payload; the fixture only
    // covers the well-typed happy path this defensive test probes around.
    mockGetSession.mockResolvedValueOnce({
      user: null,
    } as unknown as Awaited<ReturnType<AuthSessionLookupFn>>);
    const result = await Effect.runPromise(
      Effect.provide(getUserProgram, testLayer),
    );
    expect(result).toBeNull();
  });
});

describe("SessionService.getSession", () => {
  it("passes headers from factory to getSession", async () => {
    const headers = new Headers({ "x-custom": "test" });
    mockGetHeaders.mockReturnValue(headers);
    mockGetSession.mockResolvedValueOnce(makeAuthSession({ id: "user-1" }));

    await Effect.runPromise(Effect.provide(getSessionProgram, testLayer));

    expect(mockGetSession).toHaveBeenCalledWith({
      headers,
      query: { disableCookieCache: true },
    });
  });

  it("fails with SessionFetchError when the provider throws", async () => {
    mockGetSession.mockRejectedValueOnce(new Error("boom"));

    const error = await Effect.runPromise(
      Effect.provide(Effect.flip(getSessionProgram), testLayer),
    );
    expect(error._tag).toBe("SessionFetchError");
  });
});

describe("SessionService.requireActor", () => {
  it("returns the session creation time without fetching another session", async () => {
    const createdAt = new Date("2026-10-31T09:45:00.000Z");
    mockGetSession.mockResolvedValueOnce(
      makeAuthSession({ id: "user-1", role: "admin" }, { createdAt }),
    );

    const actor = await Effect.runPromise(
      Effect.provide(requireActorProgram, testLayer),
    );

    expect(actor).toEqual({
      id: "user-1",
      role: "admin",
      signedInAt: createdAt,
    });
    expect(mockGetSession).toHaveBeenCalledTimes(1);
  });
});

describe("SessionService.requireUser", () => {
  it("returns the user for a signed-in request", async () => {
    mockGetSession.mockResolvedValueOnce(makeAuthSession({ id: "user-1" }));
    const result = await Effect.runPromise(
      Effect.provide(requireUserProgram, testLayer),
    );
    expect(result).toEqual(makeSessionUser({ id: "user-1" }));
  });

  it.each([null, undefined, { session: null, user: null }])(
    "fails UnauthorizedError with the caller message when signed out (%j)",
    async (session) => {
      // SAFETY: deliberately malformed provider payloads (see the
      // "session has no user" test above).
      mockGetSession.mockResolvedValueOnce(
        session as unknown as Awaited<ReturnType<AuthSessionLookupFn>>,
      );

      const error = await Effect.runPromise(
        Effect.provide(Effect.flip(requireUserProgram), testLayer),
      );
      expect(error._tag).toBe("UnauthorizedError");
      expect(error.message).toBe("You must be logged in to vote");
    },
  );
});

describe("makeE2EAuthService", () => {
  it("synthesizes the E2E bypass session without calling the fallback adapter", async () => {
    const fallback = vi.fn(() => Effect.succeed(null));
    const adapter = makeE2EAuthService({ getSession: fallback });

    const session = await Effect.runPromise(
      adapter.getSession({
        headers: new Headers({ cookie: "e2e-test-auth=bypass" }),
        query: { disableCookieCache: true },
      }),
    );

    expect(session?.user.id).toBe("e2e-test-user");
    expect(session?.user.role).toBe("admin");
    expect(fallback).not.toHaveBeenCalled();
  });

  it("falls back to the wrapped adapter when no bypass cookie is present", async () => {
    const expected = makeAuthSession({ id: "real-user" });
    const fallback = vi.fn(() => Effect.succeed(expected));
    const adapter = makeE2EAuthService({ getSession: fallback });

    const session = await Effect.runPromise(
      adapter.getSession({
        headers: new Headers(),
        query: { disableCookieCache: true },
      }),
    );

    expect(session).toEqual(expected);
    expect(fallback).toHaveBeenCalledTimes(1);
  });
});
