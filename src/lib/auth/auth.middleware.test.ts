import { Effect, Layer } from "effect";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { AuthService, RequestHeadersService } from "../auth/context";
import { withMinimumLogLevel } from "../effect/logger";
import {
  getSessionEffect,
  getUserSessionEffect,
  requireAuthEffect,
} from "./auth.middleware";

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

describe(requireAuthEffect, () => {
  it("returns user when authenticated", async () => {
    mockGetSession.mockResolvedValueOnce({
      user: { id: "user-1", email: "test@test.com" },
    });
    const result = await runEffect(requireAuthEffect());
    expect(result).toEqual({ id: "user-1", email: "test@test.com" });
  });

  it("bypasses auth with E2E test cookie", async () => {
    const headers = new Headers({ cookie: "e2e-test-auth=bypass" });
    mockGetHeaders.mockReturnValue(headers);

    const result = await runEffect(requireAuthEffect());

    expect(result.id).toBe("e2e-test-user");
    expect(mockGetSession).not.toHaveBeenCalled();
  });

  it("throws redirect when not authenticated", async () => {
    mockGetSession.mockResolvedValueOnce(null);
    await expect(runEffect(requireAuthEffect())).rejects.toThrow();
  });
});
