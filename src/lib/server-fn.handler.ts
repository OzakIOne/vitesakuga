import type { makeMiddlewareLayer } from "./db/layer-factories.server";

export async function resolveMiddlewareLayer() {
  const factory: { makeMiddlewareLayer: typeof makeMiddlewareLayer } =
    await import("./db/layer-factories.server");
  return factory.makeMiddlewareLayer();
}
