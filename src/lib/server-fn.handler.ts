import { Effect, Layer } from "effect";

import type { makeMiddlewareLayer } from "./db/layer-factories.server";

type ServerLayer = Layer.Layer<never, unknown, unknown>;

export const baseLayerFactories = {
  // Dynamic imports keep server-only modules (AWS SDK, DB driver) out of the
  // client bundle while giving the factory call sites their concrete layer types.
  db: () => import("./db/layer-factories.server").then((m) => m.makeDBLayer()),
  auth: () =>
    import("./db/layer-factories.server").then((m) => m.makeAuthLayer()),
} satisfies Record<"db" | "auth", () => Promise<ServerLayer>>;

export const createHandler =
  <TParams = undefined, A = unknown, E = unknown>(
    effect: (data: TParams) => Effect.Effect<A, E, unknown>,
    serviceLayer: ServerLayer,
    makeBase: () => Promise<ServerLayer> = baseLayerFactories.db,
  ) =>
  async ({ data }: { data: TParams }): Promise<A> => {
    const base = await makeBase();
    const layer = serviceLayer.pipe(Layer.provideMerge(base));

    // SAFETY: the merged layer provides every service the effect requires; the
    // erased layer types cannot express that, so the assertion asserts the
    // requirements are satisfied at this Effect -> Promise seam.
    // SAFETY: the merged layer provides every service the effect requires; the
    // erased layer types cannot express that, so the assertion asserts the
    // requirements are satisfied at this Effect -> Promise seam.
    // oxlint-disable-next-line effecttsgo/unsafe-effect-type-assertion -- the layer is built from concrete factories, so the requirements channel is fully provided
    const provided = effect(data).pipe(
      Effect.provide(layer),
      Effect.tapError((error) =>
        Effect.logError("Server function failed").pipe(
          Effect.annotateLogs({ error }),
        ),
      ),
    ) as Effect.Effect<A, unknown, never>;
    return Effect.runPromise(provided);
  };

export async function resolveMiddlewareLayer() {
  const factory: { makeMiddlewareLayer: typeof makeMiddlewareLayer } =
    await import("./db/layer-factories.server");
  return factory.makeMiddlewareLayer();
}
