import { createServerFn } from "@tanstack/react-start";
import { Context, Effect, Layer } from "effect";

import { KyselyDB } from "../db/context";
import { SqlError } from "../effect/effect.utils";
import { baseLayerFactories, createHandler } from "../server-fn.handler";
import { mapPopularTags } from "./tags.utils";

export class TagsService extends Context.Service<
  TagsService,
  {
    readonly all: () => Effect.Effect<{ id: number; name: string }[], SqlError>;
    readonly popular: () => Effect.Effect<
      ReturnType<typeof mapPopularTags>,
      SqlError
    >;
  }
>()("TagsService", {
  make: Effect.gen(function* () {
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
}) {
  static readonly all = Effect.fn("TagsService.all")(function* () {
    const svc = yield* TagsService;
    return yield* svc.all();
  });

  static readonly popular = Effect.fn("TagsService.popular")(function* () {
    const svc = yield* TagsService;
    return yield* svc.popular();
  });
}

export const TagsServiceLive = Layer.effect(TagsService, TagsService.make);

export const getAllTags = createServerFn().handler(
  createHandler(TagsServiceLive, baseLayerFactories.db)(TagsService.all),
);

export const getAllPopularTags = createServerFn().handler(
  createHandler(TagsServiceLive, baseLayerFactories.db)(TagsService.popular),
);
