import { Effect } from "effect";
import { describe, expect, it } from "vitest";

import {
  RateLimitExceeded,
  RateLimiter,
  RateLimiterMemory,
} from "./rate-limiter";

const provide = Effect.provide(RateLimiterMemory);

const check = (key: string, limit: number, windowMs: number) =>
  Effect.gen(function* () {
    const limiter = yield* RateLimiter;
    return yield* limiter.check(key, { limit, windowMs });
  });

describe("RateLimiter (in-memory fixed window)", () => {
  it("allows requests within the window budget", async () => {
    await expect(
      Effect.runPromise(
        Effect.all([
          check("k1", 3, 60_000),
          check("k1", 3, 60_000),
          check("k1", 3, 60_000),
        ]).pipe(provide),
      ),
    ).resolves.toBeDefined();
  });

  it("fails with RateLimitExceeded once the budget is exhausted", async () => {
    await expect(
      Effect.runPromise(
        Effect.gen(function* () {
          yield* check("k2", 2, 60_000);
          yield* check("k2", 2, 60_000);
          return yield* check("k2", 2, 60_000);
        }).pipe(provide),
      ),
    ).rejects.toBeInstanceOf(RateLimitExceeded);
  });

  it("resets the window once it expires", async () => {
    await expect(
      Effect.runPromise(
        Effect.gen(function* () {
          yield* check("k3", 1, 1);
          yield* Effect.sleep("5 millis");
          return yield* check("k3", 1, 1);
        }).pipe(provide),
      ),
    ).resolves.toBeUndefined();
  });
});
