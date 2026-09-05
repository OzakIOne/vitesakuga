import { Effect, Exit } from "effect";
import { TestClock } from "effect/testing";
import { describe, expect, it } from "vitest";

import {
  RateLimitExceeded,
  RateLimiter,
  RateLimiterMemory,
} from "./rate-limiter";

const provide = Effect.provide([RateLimiterMemory, TestClock.layer()]);

const check = (key: string, limit: number, windowMs: number) =>
  Effect.gen(function* () {
    const limiter = yield* RateLimiter;
    return yield* limiter.check(key, { limit, windowMs });
  });

describe("RateLimiter (in-memory fixed window)", () => {
  it("allows requests within the window budget", async () => {
    const result = await Effect.gen(function* () {
      yield* check("k1", 3, 60_000);
      yield* check("k1", 3, 60_000);
      return yield* check("k1", 3, 60_000);
    })
      .pipe(provide)
      .pipe(Effect.runPromise);
    expect(result).toBeUndefined();
  });

  it("fails with RateLimitExceeded once the budget is exhausted", async () => {
    const error = await Effect.gen(function* () {
      yield* check("k2", 2, 60_000);
      yield* check("k2", 2, 60_000);
      return yield* check("k2", 2, 60_000);
    })
      .pipe(Effect.flip, provide)
      .pipe(Effect.runPromise);
    expect(error).toBeInstanceOf(RateLimitExceeded);
    expect(error._tag).toBe("RateLimitExceeded");
  });

  it("reports the time until the window rolls over as retryAfterSeconds", async () => {
    const error = await Effect.gen(function* () {
      yield* check("retry", 1, 2_000);
      return yield* check("retry", 1, 2_000);
    })
      .pipe(Effect.flip, provide)
      .pipe(Effect.runPromise);
    expect(error).toBeInstanceOf(RateLimitExceeded);
    expect(error.retryAfterSeconds).toBe(2);
  });

  it("resets the window once it expires (test clock)", async () => {
    const result = await Effect.gen(function* () {
      yield* check("k3", 1, 1);
      yield* TestClock.adjust("5 millis");
      return yield* check("k3", 1, 1);
    })
      .pipe(provide)
      .pipe(Effect.runPromise);
    expect(result).toBeUndefined();
  });

  it("denies a request 1 millisecond before the window edge, allows at the edge", async () => {
    const [beforeEdge, atEdge] = await Effect.gen(function* () {
      yield* check("edge", 1, 1_000);
      yield* TestClock.adjust("999 millis");
      const beforeEdge = yield* Effect.exit(check("edge", 1, 1_000));
      yield* TestClock.adjust("1 millis");
      const atEdge = yield* Effect.exit(check("edge", 1, 1_000));
      return [beforeEdge, atEdge] as const;
    })
      .pipe(provide)
      .pipe(Effect.runPromise);
    expect(Exit.isFailure(beforeEdge)).toBe(true);
    expect(Exit.isSuccess(atEdge)).toBe(true);
  });

  it("keeps budgets isolated per key", async () => {
    const result = await Effect.gen(function* () {
      yield* check("key-a", 1, 60_000);
      yield* check("key-b", 1, 60_000);
      return yield* check("key-b", 1, 60_000);
    })
      .pipe(Effect.flip, provide)
      .pipe(Effect.runPromise);
    // key-a and key-b each consumed their own budget; only key-b's second
    // request exceeds the limit.
    expect(result).toBeInstanceOf(RateLimitExceeded);
  });
});
