import { Effect, Layer } from "effect";

import { ValidationError } from "./errors";

export const baseLayerFactories = {
  // Dynamic imports keep server-only modules (AWS SDK, DB driver) out of the
  // client bundle while giving the factory call sites their concrete layer types.
  db: () => import("./db/layer-factories.server").then((m) => m.makeDBLayer()),
  auth: () =>
    import("./db/layer-factories.server").then((m) => m.makeAuthLayer()),
};

/**
 * Error tags whose `message` is authored by this app and intended for the
 * user. Everything else (SqlError, RowParseError, SessionFetchError, unknown
 * throws, framework errors) may embed internals — DB driver text, schema
 * decode output, stack context — and is replaced with a generic message
 * carrying a debug ID.
 */
const CLIENT_SAFE_ERROR_TAGS = new Set([
  "CommentNotFoundError",
  "EditAlreadyResolvedError",
  "EditNotFoundError",
  "ForbiddenError",
  "PlaylistNotFoundError",
  "PostAlreadyInPlaylistError",
  "PostNotFoundError",
  "PromotionAlreadyReviewedError",
  "PromotionNotEligibleError",
  "UnauthorizedError",
  "UserNotFoundError",
]);

const isTaggedError = (error: Error): error is TaggedFailure => {
  // A `_tag` property must be a string discriminator: any `Error` that
  // happens to carry a non-string `_tag` is NOT a tagged failure.
  if (!("_tag" in error)) {
    return false;
  }
  return typeof error._tag === "string";
};

/** Effect `TaggedError` instances are Errors carrying a `_tag` discriminator. */
type TaggedFailure = Error & { readonly _tag: string };

/**
 * Map a server failure to what may cross the wire. Known domain errors pass
 * through untouched; `ValidationError` keeps its user-facing message but
 * drops `cause` (schema-decode internals); anything else collapses to a
 * generic message with a debug ID for log correlation.
 */
// oxlint-disable-next-line anti-slop/no-unknown-parameters -- toClientSafeError IS the I/O boundary: it receives arbitrary Effect failures and decides what may cross the wire.
const toClientSafeError = (error: unknown, debugId: string): Error => {
  // SAFETY: failures reaching this boundary are Effect TaggedError instances
  // (Error subclasses with a string `_tag`); anything else is treated as
  // internal and replaced below.
  if (error instanceof Error && isTaggedError(error)) {
    if (error._tag === "ValidationError") {
      return new ValidationError({ message: error.message });
    }
    if (CLIENT_SAFE_ERROR_TAGS.has(error._tag)) {
      return error;
    }
  }
  return new Error(`Something went wrong. Debug ID: ${debugId}`);
};

/**
 * Bridge a service effect to a TanStack Start server function.
 *
 * The first call takes the service layer and the base infrastructure layer;
 * the second takes the effect itself. Currying lets TypeScript infer the
 * concrete layer services before checking that the effect's requirements are
 * covered by `ServiceOut | BaseOut`.
 *
 * Failures are logged server-side (Cloudflare worker logs) annotated with a
 * `debugId`, then replaced by a client-safe error carrying that same ID, so
 * a user-visible "Debug ID: …" can be correlated to the full detail by
 * searching the dashboard logs for the ID.
 */
export const createHandler =
  <
    BaseOut,
    ServiceIn extends BaseOut,
    ServiceError = never,
    BaseError = never,
    ServiceOut = never,
  >(
    serviceLayer: Layer.Layer<ServiceOut, ServiceError, ServiceIn>,
    makeBase: () => Promise<Layer.Layer<BaseOut, BaseError, never>>,
  ) =>
  <
    TParams = undefined,
    A = unknown,
    E = never,
    R extends ServiceOut | BaseOut = never,
  >(
    effect: (data: TParams) => Effect.Effect<A, E, R>,
  ) =>
  ({ data }: { data: TParams }): Promise<A> => {
    // Generated up front so every failure — typed, defect or construction —
    // can be correlated with the generic error message the client receives.
    // oxlint-disable-next-line effecttsgo/crypto-random-uuid -- debug IDs must be unpredictable and collision-free per isolate; Effect's Random is Math.random-based (the storage adapter keeps the same trade-off for object keys)
    const debugId = crypto.randomUUID();

    // Base construction, the service-layer build and the effect itself all
    // run INSIDE the Effect. A synchronous throw from `effect(data)`, a
    // rejected `makeBase()` promise, a failing or defecting layer builder
    // and an `Effect.die` all become defects or typed failures here — none
    // of them can bypass the logging + sanitization below.
    const guarded = Effect.gen(function* () {
      const base = yield* Effect.promise(() => makeBase());
      const layer = serviceLayer.pipe(Layer.provideMerge(base));
      return yield* effect(data).pipe(Effect.provide(layer));
    });

    return Effect.runPromise(
      guarded.pipe(
        // Defects bypass the failure channel entirely; fold them into it as
        // plain Errors so the single logging + sanitization below applies.
        Effect.catchDefect((defect) =>
          Effect.fail(
            defect instanceof Error
              ? defect
              : new Error(`Non-error defect: ${String(defect)}`),
          ),
        ),
        Effect.tapError((error) =>
          Effect.logError(`Server function failed (debugId: ${debugId})`).pipe(
            Effect.annotateLogs({ debugId, error }),
          ),
        ),
        Effect.mapError((error) => toClientSafeError(error, debugId)),
      ),
    );
  };

export const resolveMiddlewareLayer = () =>
  import("./db/layer-factories.server").then((m) => m.makeMiddlewareLayer());
