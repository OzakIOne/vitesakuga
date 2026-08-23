import { Effect, Layer } from "effect";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { AuthService, RequestHeadersService } from "../auth/context";
import type { AuthSessionProvider } from "../auth/context";
import { SessionService, SessionServiceLive } from "./session.effect";

type GetSessionFn = AuthSessionProvider["api"]["getSession"];

let mockGetSession: ReturnType<typeof vi.fn>;
let mockGetHeaders: ReturnType<typeof vi.fn>;
// SAFETY: the mocked provider functions are plain vi.fn doubles; their shapes
// are exercised by the runtime assertions below, so each use site narrows them
// to the Better Auth contract explicitly.
const asGetSession = () => mockGetSession as unknown as GetSessionFn;
const asHeaders = () => mockGetHeaders as unknown as () => Headers;

let testLayer: Layer.Layer<SessionService>;

beforeEach(() => {
  mockGetSession = vi.fn();
  mockGetHeaders = vi.fn(() => new Headers());

  testLayer = SessionServiceLive.pipe(
    Layer.provide(
      Layer.mergeAll(
        Layer.succeed(AuthService)({
          api: { getSession: asGetSession() },
        }),
        Layer.succeed(RequestHeadersService)(asHeaders()),
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
    mockGetSession.mockResolvedValueOnce({ user: { id: "user-1" } });
    const result = await Effect.runPromise(
      Effect.provide(getUserProgram, testLayer),
    );
    expect(result).toEqual({ id: "user-1" });
  });

  it("returns null when no session", async () => {
    mockGetSession.mockResolvedValueOnce(null);
    const result = await Effect.runPromise(
      Effect.provide(getUserProgram, testLayer),
    );
    expect(result).toBeNull();
  });

  it("returns null when session has no user", async () => {
    mockGetSession.mockResolvedValueOnce({ user: null });
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
    mockGetSession.mockResolvedValueOnce({ user: { id: "user-1" } });

    await Effect.runPromise(Effect.provide(getSessionProgram, testLayer));

    expect(mockGetSession).toHaveBeenCalledWith({
      headers,
      query: { disableCookieCache: true },
    });
  });

  it("fails with SessionFetchError when the provider throws", async () => {
    mockGetSession.mockRejectedValueOnce(new Error("boom"));

    await expect(
      Effect.runPromise(Effect.provide(getSessionProgram, testLayer)),
    ).rejects.toMatchObject({ _tag: "SessionFetchError" });
  });
});

describe("SessionService.requireUser", () => {
  it("returns the user for a signed-in request", async () => {
    mockGetSession.mockResolvedValueOnce({ user: { id: "user-1" } });
    const result = await Effect.runPromise(
      Effect.provide(requireUserProgram, testLayer),
    );
    expect(result).toEqual({ id: "user-1" });
  });

  it.each([null, undefined, { session: null, user: null }])(
    "fails UnauthorizedError with the caller message when signed out (%j)",
    async (session) => {
      mockGetSession.mockResolvedValueOnce(session);

      await expect(
        Effect.runPromise(Effect.provide(requireUserProgram, testLayer)),
      ).rejects.toMatchObject({
        _tag: "UnauthorizedError",
        message: "You must be logged in to vote",
      });
    },
  );
});
