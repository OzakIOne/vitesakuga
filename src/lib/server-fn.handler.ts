import { Effect, Layer } from "effect";

import type {
  makeDBLayer,
  makeMiddlewareLayer,
} from "./db/layer-factories.server";

type MakeBaseLayer = typeof makeDBLayer;

export async function resolveMiddlewareLayer() {
  const factory: { makeMiddlewareLayer: typeof makeMiddlewareLayer } =
    await import("./db/layer-factories.server");
  return factory.makeMiddlewareLayer();
}

export function createHandler<TParams>(
  effect: (params: TParams) => Effect.Effect<any, Error, any>,
  serviceLayer: Layer.Layer<any, never, any>,
  makeBaseLayer?: MakeBaseLayer,
) {
  return async ({ data }: { data: TParams }): Promise<any> => {
    let base: Layer.Layer<any, never, any>;
    if (makeBaseLayer) {
      base = await makeBaseLayer();
    } else {
      const factory: { makeDBLayer: typeof makeDBLayer } =
        await import("./db/layer-factories.server");
      base = await factory.makeDBLayer();
    }
    const layer = serviceLayer.pipe(Layer.provideMerge(base));
    return Effect.runPromise(
      effect(data).pipe(
        Effect.provide(layer),
        Effect.tapError((error) =>
          Effect.logError("Server function failed").pipe(
            Effect.annotateLogs({ error: String(error) }),
          ),
        ),
      ) as Effect.Effect<any, Error>,
    );
  };
}
