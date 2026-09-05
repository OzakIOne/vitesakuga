import type { RateLimit } from "@cloudflare/workers-types";
import { Effect } from "effect";
import { defineMiddleware } from "nitro";

import {
  RateLimitExceeded,
  RateLimiter,
  RateLimiterMemory,
} from "./rate-limiter";

/**
 * Cloudflare runtime env exposed on the Nitro request (`event.req.runtime`)
 * when running on a Worker. Typed loosely here because Nitro types the runtime
 * generically; the shape is the standard `{ cloudflare: { env, ctx } }`.
 */
type CloudflareRuntime = {
  cloudflare?: {
    env?: { RATE_LIMIT?: RateLimit };
  };
};

/**
 * App-level (Nitro) rate limiter for mutation requests.
 *
 * Complements the Cloudflare edge binding (per-IP, globally consistent) with a
 * per-isolate Effect token bucket as a defence-in-depth fallback and a dev
 * implementation. Applies to write requests (POST) which map to TanStack Start
 * server functions and the Better Auth API.
 *
 * Registered as global middleware in `nitro.config.ts` (`handlers`).
 */

// Resolve the in-memory limiter once; the `Layer.effect` memoises the backing
// Ref so the counter state is shared across every request in the isolate.
let limiter = Effect.runSync(
  Effect.gen(function* () {
    return yield* RateLimiter;
  }).pipe(Effect.provide(RateLimiterMemory)),
);

/**
 * Swap the module-scoped limiter and return the previous one. The limiter is
 * built at import time with the real clock and no injectable seam, so tests
 * that need a failing limiter use this instead of mocking the module graph.
 */
export const setRateLimiterForTests = (
  next: RateLimiter["Service"],
): RateLimiter["Service"] => {
  const previous = limiter;
  limiter = next;
  return previous;
};

const MUTATION_WINDOW_MS = 60_000;
const MUTATION_LIMIT = 60;

const ipFromEvent = (
  event: Parameters<Parameters<typeof defineMiddleware>[0]>[0],
): string => {
  const headers = event.req.headers;
  const cfIp = headers.get("cf-connecting-ip");
  if (cfIp) {
    return cfIp;
  }
  const forwarded = headers.get("x-forwarded-for");
  if (forwarded) {
    const first = forwarded.split(",")[0];
    return first?.trim() || "unknown";
  }
  return "unknown";
};

export default defineMiddleware(async (event) => {
  // Only guard state-changing requests.
  if (event.req.method !== "POST") {
    return;
  }
  const ip = ipFromEvent(event);

  // Prefer the Cloudflare edge binding (globally consistent) when present;
  // fall back to the in-memory Effect limiter (per-isolate / dev).
  // SAFETY: Nitro exposes the Worker runtime bindings under
  // `event.req.runtime.cloudflare` on the Cloudflare preset; the runtime is
  // typed generically, so we cast to the known shape and treat it as optional.
  const cfEnv = (event.req.runtime as CloudflareRuntime | undefined)?.cloudflare
    ?.env;
  const cfRateLimit = cfEnv?.RATE_LIMIT;
  if (cfRateLimit) {
    const outcome = await cfRateLimit.limit({ key: `mut:${ip}` });
    if (!outcome.success) {
      return rateLimitResponse(undefined);
    }
    return;
  }

  let retryAfter: number | null = null;
  try {
    await Effect.runPromise(
      limiter.check(`mut:${ip}`, {
        limit: MUTATION_LIMIT,
        windowMs: MUTATION_WINDOW_MS,
      }),
    );
  } catch (error) {
    if (error instanceof RateLimitExceeded) {
      retryAfter = error.retryAfterSeconds;
    } else {
      // Re-throw unexpected failures so they surface as 500s, not silent 429s.
      throw error;
    }
  }
  if (retryAfter !== null) {
    return rateLimitResponse(retryAfter);
  }
});

const rateLimitResponse = (retryAfter: number | undefined) => {
  const headers = new Headers({ "content-type": "application/json" });
  if (retryAfter !== undefined) {
    headers.set("x-retry-after", String(retryAfter));
  }
  return new Response(
    JSON.stringify({
      message: "Too many requests. Please try again later.",
    }),
    {
      status: 429,
      statusText: "Too Many Requests",
      headers,
    },
  );
};
