import { createServerFn } from "@tanstack/react-start";
import { Effect } from "effect";

import { KyselyDB } from "../db/context";
import { mapPopularTags } from "../posts/posts.utils";

const importFactories = () => import("../db/layer-factories.server");

export const getAllTagsEffect = Effect.fn("getAllTags")(function* () {
  const db = yield* KyselyDB;
  yield* Effect.logDebug("Fetching all tags...");
  const tags = yield* Effect.tryPromise({
    try: () => db.selectFrom("tags").select(["id", "name"]).execute(),
    catch: (error) => new Error(`Failed to fetch tags: ${String(error)}`),
  });
  yield* Effect.logInfo(`Fetched ${tags.length} tags.`);
  return tags;
});

export const getAllPopularTagsEffect = Effect.fn("getAllPopularTags")(
  function* () {
    const db = yield* KyselyDB;
    yield* Effect.logDebug("Fetching popular tags...");
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
    yield* Effect.logInfo(`Fetched ${popularTagsResult.length} popular tags.`);
    return mapPopularTags(popularTagsResult);
  },
);

// ---- createServerFn wrappers ----

export const getAllTags = createServerFn().handler(async () => {
  const { makeDBLayer } = await importFactories();
  const layer = await makeDBLayer();
  return Effect.runPromise(getAllTagsEffect().pipe(Effect.provide(layer)));
});

export const getAllPopularTags = createServerFn().handler(async () => {
  const { makeDBLayer } = await importFactories();
  const layer = await makeDBLayer();
  return Effect.runPromise(
    getAllPopularTagsEffect().pipe(Effect.provide(layer)),
  );
});
