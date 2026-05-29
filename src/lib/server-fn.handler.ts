import { Effect, Layer } from "effect";

const importFactories = () => import("./db/layer-factories.server");

type Mode = "db" | "auth";

export async function resolveEffectLayer(
  serviceLayer: Layer.Layer<any, never, any>,
  mode: Mode = "db",
) {
  const factory = await importFactories();
  const base =
    mode === "auth"
      ? await factory.makeAuthLayer()
      : await factory.makeDBLayer();
  return serviceLayer.pipe(Layer.provideMerge(base));
}

export async function resolveMiddlewareLayer() {
  const { makeMiddlewareLayer } = await importFactories();
  return makeMiddlewareLayer();
}

export function createHandler<TParams>(
  effect: (params: TParams) => Effect.Effect<any, Error, any>,
  serviceLayer: Layer.Layer<any, never, any>,
  mode?: Mode,
) {
  return async ({ data }: { data: TParams }): Promise<any> => {
    const layer = await resolveEffectLayer(serviceLayer, mode);
    return Effect.runPromise(
      effect(data).pipe(Effect.provide(layer)) as Effect.Effect<any, Error>,
    );
  };
}
