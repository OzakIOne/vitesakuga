import { createServerFn } from "@tanstack/react-start";
import { Effect, Layer } from "effect";

import { TagsService, TagsServiceLive } from "../tags/tags.service";

const importFactories = () => import("../db/layer-factories.server");

export const getAllTagsEffect = Effect.fn("getAllTags")(function* () {
  const svc = yield* TagsService;
  return yield* svc.all();
});

export const getAllPopularTagsEffect = Effect.fn("getAllPopularTags")(
  function* () {
    const svc = yield* TagsService;
    return yield* svc.popular();
  },
);

// ---- createServerFn wrappers ----

export const getAllTags = createServerFn().handler(async () => {
  const { makeDBLayer } = await importFactories();
  const dbLayer = await makeDBLayer();
  const layer = TagsServiceLive.pipe(Layer.provideMerge(dbLayer));
  return Effect.runPromise(getAllTagsEffect().pipe(Effect.provide(layer)));
});

export const getAllPopularTags = createServerFn().handler(async () => {
  const { makeDBLayer } = await importFactories();
  const dbLayer = await makeDBLayer();
  const layer = TagsServiceLive.pipe(Layer.provideMerge(dbLayer));
  return Effect.runPromise(
    getAllPopularTagsEffect().pipe(Effect.provide(layer)),
  );
});
