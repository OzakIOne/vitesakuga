import { createServerFn } from "@tanstack/react-start";
import { Effect } from "effect";

import { resolveEffectLayer } from "../server-fn.handler";
import { TagsService, TagsServiceLive } from "../tags/tags.service";

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

export const getAllTags = createServerFn().handler(async () => {
  const layer = await resolveEffectLayer(TagsServiceLive);
  return Effect.runPromise(
    getAllTagsEffect().pipe(Effect.provide(layer)) as Effect.Effect<any, Error>,
  );
});

export const getAllPopularTags = createServerFn().handler(async () => {
  const layer = await resolveEffectLayer(TagsServiceLive);
  return Effect.runPromise(
    getAllPopularTagsEffect().pipe(Effect.provide(layer)) as Effect.Effect<
      any,
      Error
    >,
  );
});
