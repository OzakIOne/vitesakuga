import { Effect, Layer } from "effect";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { AuthService, RequestHeadersService } from "../auth/context";
import { withMinimumLogLevel } from "../effect/logger";
import { getSessionEffect, getUserSessionEffect } from "./auth.middleware";

let mockGetSession: ReturnType<typeof vi.fn>;
let mockGetHeaders: ReturnType<typeof vi.fn>;
let testLayer: Layer.Layer;

const runEffect = <T>(effect: Effect.Effect<T>) =>
  Effect.runPromise(effect.pipe(Effect.provide(testLayer)));

beforeEach(() => {
  mockGetSession = vi.fn();
  mockGetHeaders = vi.fn(() => new Headers());

  testLayer = Layer.mergeAll(
    Layer.succeed(AuthService)({ api: { getSession: mockGetSession } }),
    Layer.succeed(RequestHeadersService)(mockGetHeaders),
    withMinimumLogLevel("Debug"),
  );
});

describe(getUserSessionEffect, () => {
  it("returns user when session exists", async () => {
    mockGetSession.mockResolvedValueOnce({ user: { id: "user-1" } });
    const result = await runEffect(getUserSessionEffect());
    expect(result).toEqual({ id: "user-1" });
  });

  it("returns null when no session", async () => {
    mockGetSession.mockResolvedValueOnce(null);
    const result = await runEffect(getUserSessionEffect());
    expect(result).toBeNull();
  });

  it("returns null when session has no user", async () => {
    mockGetSession.mockResolvedValueOnce({ user: null });
    const result = await runEffect(getUserSessionEffect());
    expect(result).toBeNull();
  });

  it("passes headers from factory to getSession", async () => {
    const headers = new Headers({ "x-custom": "test" });
    mockGetHeaders.mockReturnValue(headers);
    mockGetSession.mockResolvedValueOnce({ user: { id: "user-1" } });

    await runEffect(getSessionEffect());

    expect(mockGetSession).toHaveBeenCalledWith({
      headers,
      query: { disableCookieCache: true },
    });
  });
});
