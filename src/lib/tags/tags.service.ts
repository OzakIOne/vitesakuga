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
      return yield* db.execute(
        db.selectFrom("tags").select(["id", "name"]),
      );
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
