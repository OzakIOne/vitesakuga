import { Effect } from "effect";
import { afterEach, describe, expect, it, vi } from "vitest";

import middleware, { setRateLimiterForTests } from "./rate-limit.middleware";

// `defineMiddleware` is the identity function, so the default export IS the
// request handler and can be driven with a plain event object. The event type
// is Nitro's rich H3Event; the test only exercises the small surface the
// middleware reads (method, headers, optional `req.runtime` Cloudflare env),
// so the fixture restates that shape with a single documented cast.
type MiddlewareEvent = Parameters<typeof middleware>[0];

// h3's Middleware type carries a required `next` continuation the app
// middleware never uses; the alias narrows the signature to the surface this
// test drives (event only, returning a Response or nothing).
const handler = middleware as unknown as (
  event: MiddlewareEvent,
  next?: () => unknown,
) => Promise<Response | undefined> | Response | undefined;

type CloudflareRateLimitStub = {
  limit: (args: { key: string }) => Promise<{ success: boolean }>;
};

const makeEvent = (args: {
  headers?: Array<[string, string]>;
  method?: string;
  rateLimit?: CloudflareRateLimitStub;
}): MiddlewareEvent =>
  ({
    req: {
      headers: new Headers(args.headers ?? []),
      method: args.method ?? "POST",
      ...(args.rateLimit
        ? { runtime: { cloudflare: { env: { RATE_LIMIT: args.rateLimit } } } }
        : {}),
    },
  }) as unknown as MiddlewareEvent;

// Unique IPs per test: the module-scoped in-memory limiter shares state
// across the whole file, so budgets never bleed between cases. Windows are
// never awaited (the real 60s window outlives each test), so no sleeps and
// no clock control are needed at this layer — the module-level limiter has
// no clock seam, which is why unexpected-failure coverage uses the
// `setRateLimiterForTests` seam instead.
let ipSeq = 0;
const nextIp = () => {
  ipSeq += 1;
  return `10.${Math.floor(ipSeq / 250) % 250}.${ipSeq % 250}.${(ipSeq * 7) % 250}`;
};

afterEach(() => {
  vi.restoreAllMocks();
});

describe("rate-limit middleware", () => {
  it("lets non-POST requests through untouched", async () => {
    await expect(
      handler(makeEvent({ method: "GET" })),
    ).resolves.toBeUndefined();
    await expect(
      handler(makeEvent({ method: "PUT" })),
    ).resolves.toBeUndefined();
  });

  it("uses the Cloudflare edge binding when present, keyed per client IP", async () => {
    const limit = vi.fn(async () => ({ success: true }));
    const ip = nextIp();

    const result = await handler(
      makeEvent({
        headers: [["cf-connecting-ip", ip]],
        rateLimit: { limit },
      }),
    );

    expect(result).toBeUndefined();
    expect(limit).toHaveBeenCalledExactlyOnceWith({ key: `mut:${ip}` });
  });

  it("returns a bare 429 when the edge binding denies", async () => {
    const limit = vi.fn(async () => ({ success: false }));

    const response = await handler(
      makeEvent({
        headers: [["cf-connecting-ip", nextIp()]],
        rateLimit: { limit },
      }),
    );

    expect(response).toBeInstanceOf(Response);
    expect(response?.status).toBe(429);
    // The edge binding reports its own window; no in-process retry estimate.
    expect(response?.headers.get("x-retry-after")).toBeNull();
  });

  it("prefers cf-connecting-ip over x-forwarded-for and takes the first hop", async () => {
    const limit = vi.fn(async () => ({ success: true }));

    await handler(
      makeEvent({
        headers: [
          ["cf-connecting-ip", "203.0.113.9"],
          ["x-forwarded-for", "198.51.100.7, 10.0.0.1"],
        ],
        rateLimit: { limit },
      }),
    );
    expect(limit).toHaveBeenCalledWith({ key: "mut:203.0.113.9" });

    await handler(
      makeEvent({
        headers: [["x-forwarded-for", "198.51.100.7 , 10.0.0.1"]],
        rateLimit: { limit },
      }),
    );
    expect(limit).toHaveBeenLastCalledWith({ key: "mut:198.51.100.7" });
  });

  it("falls back to the in-memory limiter and 429s with Retry-After when exhausted", async () => {
    const ip = nextIp();
    const event = makeEvent({ headers: [["x-forwarded-for", ip]] });

    // The in-memory budget (60 POSTs / 60s window) absorbs the first 60 hits.
    for (let i = 0; i < 60; i += 1) {
      await expect(handler(event)).resolves.toBeUndefined();
    }
    const denied = await handler(event);

    expect(denied).toBeInstanceOf(Response);
    expect(denied?.status).toBe(429);
    expect(await denied?.json()).toEqual({
      message: "Too many requests. Please try again later.",
    });
    const retryAfter = denied?.headers.get("x-retry-after");
    expect(retryAfter).not.toBeNull();
    // The whole loop runs inside one window: roughly 60s remain.
    const seconds = Number(retryAfter);
    expect(seconds).toBeGreaterThanOrEqual(55);
    expect(seconds).toBeLessThanOrEqual(60);
  });

  it("rethrows unexpected limiter failures instead of masking them as 429s", async () => {
    // The promise rejects with the raw rethrow (a defect, not a typed
    // failure), so `rejects.toThrow` — not `Effect.flip` — is the right
    // assertion here.
    // The module-scoped limiter is built with the real clock at import, so a
    // failing double goes through the first-class seam (no module mocking,
    // no fresh copy of the module graph). A throwing `Effect.sync` models an
    // unexpected failure: the middleware must rethrow, not answer 429.
    const previous = setRateLimiterForTests({
      check: () =>
        Effect.sync(() => {
          throw new Error("redis connection lost");
        }),
    });
    try {
      await expect(
        handler(makeEvent({ headers: [["cf-connecting-ip", nextIp()]] })),
      ).rejects.toThrow("redis connection lost");
    } finally {
      setRateLimiterForTests(previous);
    }
  });
});
