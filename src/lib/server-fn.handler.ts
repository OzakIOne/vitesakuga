import { Effect, Layer } from "effect";

import type { makeMiddlewareLayer } from "./db/layer-factories.server";

export const baseLayerFactories = {
  // Dynamic imports keep server-only modules (AWS SDK, DB driver) out of the
  // client bundle while giving the factory call sites their concrete layer types.
  db: () => import("./db/layer-factories.server").then((m) => m.makeDBLayer()),
  auth: () =>
    import("./db/layer-factories.server").then((m) => m.makeAuthLayer()),
};

/**
 * Bridge a service effect to a TanStack Start server function.
 *
 * The first call takes the service layer and the base infrastructure layer;
 * the second takes the effect itself. Currying lets TypeScript infer the
 * concrete layer services before checking that the effect's requirements are
 * covered by `ServiceOut | BaseOut`.
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
  async ({ data }: { data: TParams }): Promise<A> => {
    const base = await makeBase();
    const layer = serviceLayer.pipe(Layer.provideMerge(base));
    return Effect.runPromise(
      effect(data).pipe(
        Effect.provide(layer),
        Effect.tapError((error) =>
          Effect.logError("Server function failed").pipe(
            Effect.annotateLogs({ error }),
          ),
        ),
      ),
    );
  };

export async function resolveMiddlewareLayer() {
  const factory: { makeMiddlewareLayer: typeof makeMiddlewareLayer } =
    await import("./db/layer-factories.server");
  return factory.makeMiddlewareLayer();
}
