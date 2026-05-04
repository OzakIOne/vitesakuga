import { createServerFn } from "@tanstack/react-start";
import { Effect } from "effect";
import { kysely } from "src/lib/db/kysely";
import { Debug, withMinimumLogLevel } from "../effect/logger";
import { mapPopularTags } from "../posts/posts.utils";

export const getAllTags = createServerFn().handler(() =>
  Effect.runPromise(
    Effect.fn("getAllTags")(
      function* () {
        yield* Effect.logDebug("Fetching all tags...");
        const tags = yield* Effect.tryPromise({
          try: () =>
            kysely.selectFrom("tags").select(["id", "name"]).execute(),
          catch: (error) =>
            new Error(`Failed to fetch tags: ${String(error)}`),
        });
        yield* Effect.logInfo(`Fetched ${tags.length} tags.`);
        return tags;
      },
      Effect.provide(withMinimumLogLevel(Debug)),
    )(),
  ),
);

export const getAllPopularTags = createServerFn().handler(() =>
  Effect.runPromise(
    Effect.fn("getAllPopularTags")(
      function* () {
        yield* Effect.logDebug("Fetching popular tags...");
        const popularTagsResult = yield* Effect.tryPromise({
          try: () =>
            kysely
              .selectFrom("tags")
              .select(["tags.id", "tags.name"])
              .leftJoin("post_tags", "tags.id", "post_tags.tagId")
              .select(
                kysely.fn.count("post_tags.postId").as("postCount"),
              )
              .groupBy(["tags.id", "tags.name"])
              .orderBy("postCount", "desc")
              .limit(10)
              .execute(),
          catch: (error) =>
            new Error(
              `Failed to fetch popular tags: ${String(error)}`,
            ),
        });
        yield* Effect.logInfo(
          `Fetched ${popularTagsResult.length} popular tags.`,
        );
        return mapPopularTags(popularTagsResult);
      },
      Effect.provide(withMinimumLogLevel(Debug)),
    )(),
  ),
);
