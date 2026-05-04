import { createServerFn } from "@tanstack/react-start";
import { Effect } from "effect";
import { kysely } from "src/lib/db/kysely";
import { postsSelectSchema, userSelectSchema } from "src/lib/db/schema";
import z from "zod";

import { Debug, withMinimumLogLevel } from "../effect/logger";
import { mapPopularTags } from "../posts/posts.utils";
import { fetchUserInputSchema } from "../users/users.schema";

const PAGE_SIZE = 30;

export const fetchUsers = createServerFn().handler(() =>
  Effect.runPromise(
    Effect.fn("fetchUsers")(
      function* () {
        yield* Effect.logDebug("Fetching all users from database...");
        const data = yield* Effect.tryPromise({
          try: () => kysely.selectFrom("user").selectAll().execute(),
          catch: (error) =>
            new Error(`Database error: ${String(error)}`),
        });

        yield* Effect.logDebug(
          `Fetched ${data.length} users. Parsing...`,
        );
        const parsed = yield* Effect.try({
          try: () => z.array(userSelectSchema).parse(data),
          catch: (error) =>
            new Error(
              `There was an error processing the search results: ${String(error)}`,
            ),
        });

        yield* Effect.logInfo(
          "Successfully fetched and parsed all users.",
        );
        return parsed;
      },
      Effect.provide(withMinimumLogLevel(Debug)),
    )(),
  ),
);

export const fetchUserPosts = createServerFn()
  .inputValidator((input: unknown) => fetchUserInputSchema.parse(input))
  .handler(({ data }) =>
    Effect.runPromise(
      Effect.fn("fetchUserPosts")(
        function* () {
          const { userId, tags, q, page } = data;
          const offset = page * PAGE_SIZE;

          yield* Effect.logInfo(
            `Fetching posts for user ${userId} (page ${page})`,
          );
          if (q) yield* Effect.logDebug(`Search query: "${q}"`);
          if (tags.length > 0)
            yield* Effect.logDebug(
              `Tags filter: [${tags.join(", ")}]`,
            );

          yield* Effect.logDebug("Looking up user info...");
          const userInfo = yield* Effect.tryPromise({
            try: () =>
              kysely
                .selectFrom("user")
                .select(["name", "image", "id"])
                .where("id", "=", userId)
                .executeTakeFirstOrThrow(),
            catch: (error) =>
              new Error(
                `User ${userId} not found: ${String(error)}`,
              ),
          });

          yield* Effect.logDebug("Building query...");
          let query = kysely
            .selectFrom("posts")
            .selectAll()
            .where("userId", "=", userId);

          if (q) {
            query = query.where((eb) =>
              eb("title", "ilike", `%${q}%`).or(
                "content",
                "ilike",
                `%${q}%`,
              ),
            );
          }

          if (tags.length > 0) {
            query = query
              .innerJoin(
                "post_tags",
                "post_tags.postId",
                "posts.id",
              )
              .innerJoin("tags", "tags.id", "post_tags.tagId")
              .where("tags.name", "in", tags)
              .selectAll("posts")
              .distinct();
          }

          yield* Effect.logDebug("Counting total posts...");
          const countQuery = query
            .clearSelect()
            .select((eb) => eb.fn.countAll().as("count"));

          const countResult = yield* Effect.tryPromise({
            try: () => countQuery.executeTakeFirst(),
            catch: (error) =>
              new Error(`Failed to count posts: ${String(error)}`),
          });
          const totalCount = Number(countResult?.count ?? 0);
          yield* Effect.logDebug(`Total posts: ${totalCount}`);

          query = query.orderBy("id", "desc");

          yield* Effect.logDebug("Fetching paginated posts...");
          const items = yield* Effect.tryPromise({
            try: () =>
              query.offset(offset).limit(PAGE_SIZE).execute(),
            catch: (error) =>
              new Error(`Failed to fetch posts: ${String(error)}`),
          });

          yield* Effect.logDebug(
            `Fetched ${items.length} items. Parsing...`,
          );
          const posts = yield* Effect.try({
            try: () => z.array(postsSelectSchema).parse(items),
            catch: (error) =>
              new Error(
                `Error processing user posts: ${String(error)}`,
              ),
          });

          const hasMore = offset + PAGE_SIZE < totalCount;
          const hasPrevious = offset > 0;

          yield* Effect.logDebug("Fetching popular tags...");
          const popularTagsResult = yield* Effect.tryPromise({
            try: () =>
              kysely
                .selectFrom("tags")
                .innerJoin(
                  "post_tags",
                  "tags.id",
                  "post_tags.tagId",
                )
                .innerJoin(
                  "posts",
                  "posts.id",
                  "post_tags.postId",
                )
                .where("posts.userId", "=", userId)
                .select([
                  "tags.id",
                  "tags.name",
                  kysely.fn
                    .count("post_tags.postId")
                    .as("postCount"),
                ])
                .groupBy(["tags.id", "tags.name"])
                .orderBy("postCount", "desc")
                .limit(10)
                .execute(),
            catch: (error) =>
              new Error(
                `Failed to fetch popular tags: ${String(error)}`,
              ),
          });

          const totalPages = Math.ceil(totalCount / PAGE_SIZE);
          const currentPage = page + 1;

          yield* Effect.logInfo(
            `Finished fetching posts for user ${userId}. Total: ${totalCount}`,
          );

          return {
            data: posts,
            meta: {
              pagination: {
                currentPage,
                hasMore,
                hasPrevious,
                limit: PAGE_SIZE,
                offset,
                total: totalCount,
                totalPages,
              },
              popularTags: mapPopularTags(
                popularTagsResult as any,
              ),
            },
            user: userInfo,
          };
        },
        Effect.provide(withMinimumLogLevel(Debug)),
      )(),
    ),
  );
