import { Effect, Layer } from "effect";
import { beforeEach, describe, expect, it, vi, type Mock } from "vitest";

import { AuthService, RequestHeadersService } from "../auth/context";
import type { AuthSessionProvider } from "../auth/context";
import { SessionService, SessionServiceLive } from "./session.effect";
import { makeAuthSession, makeSessionUser } from "./session.fixture";

type GetSessionFn = AuthSessionProvider["api"]["getSession"];

let mockGetSession: Mock<GetSessionFn>;
let mockGetHeaders: Mock<() => Headers>;

let testLayer: Layer.Layer<SessionService>;

beforeEach(() => {
  mockGetSession = vi.fn<GetSessionFn>();
  mockGetHeaders = vi.fn(() => new Headers());

  testLayer = SessionServiceLive.pipe(
    Layer.provide(
      Layer.mergeAll(
        Layer.succeed(AuthService)({
          api: { getSession: mockGetSession },
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

const requireUserProgram = Effect.gen(function* () {
  const sessions = yield* SessionService;
  return yield* sessions.requireUser("You must be logged in to vote");
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
    } as unknown as Awaited<ReturnType<GetSessionFn>>);
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
        session as unknown as Awaited<ReturnType<GetSessionFn>>,
      );

      const error = await Effect.runPromise(
        Effect.provide(Effect.flip(requireUserProgram), testLayer),
      );
      expect(error._tag).toBe("UnauthorizedError");
      expect(error.message).toBe("You must be logged in to vote");
    },
  );
});
