import { createServerFn } from "@tanstack/react-start";
import { Effect } from "effect";

import { createHandler } from "../server-fn.handler";
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

export const getAllTags = createServerFn().handler(
  createHandler(getAllTagsEffect, TagsServiceLive),
);

export const getAllPopularTags = createServerFn().handler(
  createHandler(getAllPopularTagsEffect, TagsServiceLive),
);
