import { Context, Effect, Layer } from "effect";
import { postsSelectSchema, userSelectSchema } from "src/lib/db/schema";
import z from "zod";

import { KyselyDB } from "../db/context";
import { mapPopularTags } from "../posts/posts.utils";
import { fetchUserInputSchema } from "./users.schema";

const PAGE_SIZE = 30;

export class UsersService extends Context.Service<
  UsersService,
  {
    readonly all: () => Effect.Effect<
      z.infer<typeof userSelectSchema>[],
      Error
    >;
    readonly userPosts: (
      data: z.infer<typeof fetchUserInputSchema>,
    ) => Effect.Effect<unknown, Error>;
  }
>()("UsersService") {}

export const UsersServiceLive = Layer.effect(
  UsersService,
  Effect.gen(function* () {
    const db = yield* KyselyDB;

    const all = Effect.fn("UsersService.all")(function* () {
      const data = yield* Effect.tryPromise({
        try: () => db.selectFrom("user").selectAll().execute(),
        catch: (error) => new Error(`Database error: ${String(error)}`),
      });
      const parsed = yield* Effect.try({
        try: () => z.array(userSelectSchema).parse(data),
        catch: (error) =>
          new Error(
            `There was an error processing the search results: ${String(error)}`,
          ),
      });
      return parsed;
    });

    const userPosts = Effect.fn("UsersService.userPosts")(function* (
      data: z.infer<typeof fetchUserInputSchema>,
    ) {
      const { userId, tags, q, page } = data;
      const offset = page * PAGE_SIZE;

      const userInfo = yield* Effect.tryPromise({
        try: () =>
          db
            .selectFrom("user")
            .select(["name", "image", "id"])
            .where("id", "=", userId)
            .executeTakeFirstOrThrow(),
        catch: (error) =>
          new Error(`User ${userId} not found: ${String(error)}`),
      });

      let query = db
        .selectFrom("posts")
        .selectAll()
        .where("userId", "=", userId);

      if (q) {
        query = query.where((eb) =>
          eb("title", "ilike", `%${q}%`).or("content", "ilike", `%${q}%`),
        );
      }

      if (tags.length > 0) {
        query = query
          .innerJoin("post_tags", "post_tags.postId", "posts.id")
          .innerJoin("tags", "tags.id", "post_tags.tagId")
          .where("tags.name", "in", tags)
          .selectAll("posts")
          .distinct();
      }

      const countQuery = query
        .clearSelect()
        .select((eb) => eb.fn.countAll().as("count"));
      const countResult = yield* Effect.tryPromise({
        try: () => countQuery.executeTakeFirst(),
        catch: (error) =>
          new Error(`Failed to count posts: ${String(error)}`),
      });
      const totalCount = Number(countResult?.count ?? 0);

      query = query.orderBy("id", "desc");

      const items = yield* Effect.tryPromise({
        try: () => query.offset(offset).limit(PAGE_SIZE).execute(),
        catch: (error) =>
          new Error(`Failed to fetch posts: ${String(error)}`),
      });

      const posts = yield* Effect.try({
        try: () => z.array(postsSelectSchema).parse(items),
        catch: (error) =>
          new Error(`Error processing user posts: ${String(error)}`),
      });

      const hasMore = offset + PAGE_SIZE < totalCount;
      const hasPrevious = offset > 0;

      const popularTagsResult = yield* Effect.tryPromise({
        try: () =>
          db
            .selectFrom("tags")
            .innerJoin("post_tags", "tags.id", "post_tags.tagId")
            .innerJoin("posts", "posts.id", "post_tags.postId")
            .where("posts.userId", "=", userId)
            .select([
              "tags.id",
              "tags.name",
              db.fn.count("post_tags.postId").as("postCount"),
            ])
            .groupBy(["tags.id", "tags.name"])
            .orderBy("postCount", "desc")
            .limit(10)
            .execute(),
        catch: (error) =>
          new Error(`Failed to fetch popular tags: ${String(error)}`),
      });

      const totalPages = Math.ceil(totalCount / PAGE_SIZE);
      const currentPage = page + 1;

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
          popularTags: mapPopularTags(popularTagsResult),
        },
        user: userInfo,
      };
    });

    return { all, userPosts };
  }),
);
