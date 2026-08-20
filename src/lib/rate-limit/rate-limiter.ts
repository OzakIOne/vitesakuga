import { Clock, Context, Data, Effect, Layer, Ref } from "effect";

/**
 * Rate limiting primitives used by the app-level (Nitro) rate limiter.
 *
 * A fixed-window counter keyed by string. In-memory by default (adequate for
 * dev and as a per-isolate fallback); the Cloudflare edge binding is the
 * primary, globally-consistent limiter in production.
 */

/** Thrown by {@link RateLimiter.check} when the limit for a window is reached. */
export class RateLimitExceeded extends Data.TaggedError("RateLimitExceeded")<{
  readonly retryAfterSeconds: number;
}> {}

export type RateLimitRule = {
  /** Maximum number of requests allowed within the window. */
  readonly limit: number;
  /** Window length, in milliseconds. */
  readonly windowMs: number;
};

type Bucket = {
  readonly count: number;
  readonly windowStart: number;
};

type Decision =
  | { readonly kind: "allowed" }
  | { readonly kind: "denied"; readonly retryAfterSeconds: number };

export class RateLimiter extends Context.Service<
  RateLimiter,
  {
    /**
     * Consume one request for `key` under `rule`. Fails with
     * {@link RateLimitExceeded} when the current window budget is exhausted.
     */
    readonly check: (
      key: string,
      rule: RateLimitRule,
    ) => Effect.Effect<void, RateLimitExceeded, never>;
  }
>()("RateLimiter", {
  make: Effect.gen(function* () {
    const store = yield* Ref.make(new Map<string, Bucket>());

    const check = (key: string, rule: RateLimitRule) =>
      Effect.gen(function* () {
        const now = yield* Clock.currentTimeMillis;
        const decision = yield* Ref.modify(store, (buckets) => {
          const current = buckets.get(key);
          // Fresh key or expired window → start a new window.
          if (
            current === undefined ||
            now - current.windowStart >= rule.windowMs
          ) {
            buckets.set(key, { count: 1, windowStart: now });
            return [decisionAllowed(), buckets] as const;
          }
          if (current.count >= rule.limit) {
            const retryAfterSeconds = Math.ceil(
              (current.windowStart + rule.windowMs - now) / 1000,
            );
            return [decisionDenied(retryAfterSeconds), buckets] as const;
          }
          buckets.set(key, {
            count: current.count + 1,
            windowStart: current.windowStart,
          });
          return [decisionAllowed(), buckets] as const;
        });
        if (decision.kind === "allowed") {
          return yield* Effect.succeed(undefined);
        }
        return yield* Effect.fail(
          new RateLimitExceeded({
            retryAfterSeconds: decision.retryAfterSeconds,
          }),
        );
      }).pipe(Effect.asVoid);

    return { check };
  }),
}) {}

const decisionAllowed = (): Decision => ({ kind: "allowed" });
const decisionDenied = (retryAfterSeconds: number): Decision => ({
  kind: "denied",
  retryAfterSeconds,
});

export const RateLimiterMemory = Layer.effect(RateLimiter, RateLimiter.make);
