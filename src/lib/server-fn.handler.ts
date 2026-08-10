import { Effect, Layer } from "effect";

import type { makeMiddlewareLayer } from "./db/layer-factories.server";

type LayerShape = Layer.Layer<never, unknown, unknown>;

export const baseLayerFactories = {
  // Dynamic imports keep server-only modules (AWS SDK, DB driver) out of the
  // client bundle while giving the factory call sites their concrete layer types.
  db: () => import("./db/layer-factories.server").then((m) => m.makeDBLayer()),
  auth: () =>
    import("./db/layer-factories.server").then((m) => m.makeAuthLayer()),
} satisfies Record<"db" | "auth", () => Promise<LayerShape>>;

export const createHandler =
  <TParams = undefined, A = unknown, E = unknown>(
    effect: (data: TParams) => Effect.Effect<A, E, unknown>,
    serviceLayer: LayerShape,
    makeBase: () => Promise<LayerShape> = baseLayerFactories.db,
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
        // The merged layer provides every service the effect requires; the
        // erased layer types can't express that, so we assert the requirements
        // are satisfied at this Effect → async seam.
      ) as Effect.Effect<A, unknown>,
    );
  };

export async function resolveMiddlewareLayer() {
  const factory: { makeMiddlewareLayer: typeof makeMiddlewareLayer } =
    await import("./db/layer-factories.server");
  return factory.makeMiddlewareLayer();
}
