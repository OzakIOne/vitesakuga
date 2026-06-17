import { createServerFn } from "@tanstack/react-start";
import { Context, Effect, Layer } from "effect";

import { KyselyDB } from "../db/context";
import { mapPopularTags } from "./tags.utils";

export class TagsService extends Context.Service<
  TagsService,
  {
    readonly all: () => Effect.Effect<{ id: number; name: string }[], Error>;
    readonly popular: () => Effect.Effect<
      ReturnType<typeof mapPopularTags>,
      Error
    >;
  }
>()("TagsService") {}

export const TagsServiceLive = Layer.effect(
  TagsService,
  Effect.gen(function* () {
    const db = yield* KyselyDB;

    const all = Effect.fn("TagsService.all")(function* () {
      return yield* db.execute(db.selectFrom("tags").select(["id", "name"]));
    });

    const popular = Effect.fn("TagsService.popular")(function* () {
      const popularTagsResult = yield* db.execute(
        db
          .selectFrom("tags")
          .select(["tags.id", "tags.name"])
          .leftJoin("post_tags", "tags.id", "post_tags.tagId")
          .select(db.fn.count("post_tags.postId").as("postCount"))
          .groupBy(["tags.id", "tags.name"])
          .orderBy("postCount", "desc")
          .limit(10),
      );
      return mapPopularTags(popularTagsResult);
    });

    return { all, popular };
  }),
);

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
  const { makeDBLayer } = await import("../db/layer-factories.server");
  const base = await makeDBLayer();
  const layer = TagsServiceLive.pipe(Layer.provideMerge(base));
  return Effect.runPromise(
    getAllTagsEffect().pipe(
      Effect.provide(layer),
      Effect.tapError((error) =>
        Effect.logError("Server function failed").pipe(
          Effect.annotateLogs({ error: error }),
        ),
      ),
    ),
  );
});

export const getAllPopularTags = createServerFn().handler(async () => {
  const { makeDBLayer } = await import("../db/layer-factories.server");
  const base = await makeDBLayer();
  const layer = TagsServiceLive.pipe(Layer.provideMerge(base));
  return Effect.runPromise(
    getAllPopularTagsEffect().pipe(
      Effect.provide(layer),
      Effect.tapError((error) =>
        Effect.logError("Server function failed").pipe(
          Effect.annotateLogs({ error: error }),
        ),
      ),
    ),
  );
});
