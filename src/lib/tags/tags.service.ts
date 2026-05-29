import { Context, Effect, Layer } from "effect";

import { KyselyDB } from "../db/context";
import { mapPopularTags } from "../posts/posts.utils";

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
      const tags = yield* Effect.tryPromise({
        try: () => db.selectFrom("tags").select(["id", "name"]).execute(),
        catch: (error) => new Error(`Failed to fetch tags: ${String(error)}`),
      });
      return tags;
    });

    const popular = Effect.fn("TagsService.popular")(function* () {
      const popularTagsResult = yield* Effect.tryPromise({
        try: () =>
          db
            .selectFrom("tags")
            .select(["tags.id", "tags.name"])
            .leftJoin("post_tags", "tags.id", "post_tags.tagId")
            .select(db.fn.count("post_tags.postId").as("postCount"))
            .groupBy(["tags.id", "tags.name"])
            .orderBy("postCount", "desc")
            .limit(10)
            .execute(),
        catch: (error) =>
          new Error(`Failed to fetch popular tags: ${String(error)}`),
      });
      return mapPopularTags(popularTagsResult);
    });

    return { all, popular };
  }),
);
