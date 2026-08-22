import { createServerFn } from "@tanstack/react-start";
import { Context, Effect, Layer, Option, Schema } from "effect";
import {
  postsSelectSchema,
  postWithVotesSelectSchema,
  type PostWithVotes,
} from "src/lib/db/schema";

import { KyselyDB } from "../db/context";
import { SqlError } from "../effect/effect.utils";
import { parse, parseStrict } from "../effect/schema.utils";
import { UserNotFoundError, ValidationError } from "../errors";
import { computePagination } from "../pagination/pagination";
import { escapeLikePattern } from "../posts/search-pattern";
import { baseLayerFactories, createHandler } from "../server-fn.handler";
import { mapPopularTags } from "../tags/tags.utils";
import { fetchPostVoteCounts } from "../votes/votes.utils";
import { fetchUserInputSchema, userPublicSchema } from "./users.schema";

const PAGE_SIZE = 30;

export class UsersService extends Context.Service<
  UsersService,
  {
    readonly all: () => Effect.Effect<
      readonly Schema.Schema.Type<typeof userPublicSchema>[],
      SqlError | ValidationError
    >;
    readonly userPosts: (
      data: Schema.Schema.Type<typeof fetchUserInputSchema>,
    ) => Effect.Effect<
      {
        data: readonly PostWithVotes[];
        meta: {
          pagination: {
            currentPage: number;
            hasMore: boolean;
            hasPrevious: boolean;
            limit: number;
            offset: number;
            total: number;
            totalPages: number;
          };
          popularTags: ReturnType<typeof mapPopularTags>;
        };
        user: { id: string; image: string | null; name: string };
      },
      SqlError | ValidationError | UserNotFoundError
    >;
  }
>()("UsersService", {
  make: Effect.gen(function* () {
    const db = yield* KyselyDB;

    const all = Effect.fn("UsersService.all")(function* () {
      // Skip anonymized (deleted) accounts: they are inert shells kept only
      // so posts/comments can render their "Deleted user" attribution.
      const data = yield* db.execute(
        db
          .selectFrom("user")
          .select(["id", "name", "image"])
          .where("deletedAt", "is", null),
      );
      return yield* Effect.try({
        try: () => parse(Schema.Array(userPublicSchema))(data),
        catch: (error) =>
          new ValidationError({
            message: "There was an error processing the search results",
            cause: error,
          }),
      });
    });

    const userPosts = Effect.fn("UsersService.userPosts")(function* (
      data: Schema.Schema.Type<typeof fetchUserInputSchema>,
    ) {
      const { userId, tags, q, page } = data;

      const userInfoOption = yield* db.executeTakeFirstOption(
        db
          .selectFrom("user")
          .select(["name", "image", "id"])
          .where("id", "=", userId),
      );

      const userInfo = yield* Option.match(userInfoOption, {
        onNone: () =>
          Effect.logError("User not found").pipe(
            Effect.annotateLogs("userId", userId),
            Effect.flatMap(() =>
              Effect.fail(
                new UserNotFoundError({
                  message: `User ${userId} not found`,
                  userId,
                }),
              ),
            ),
          ),
        onSome: (value) => Effect.succeed(value),
      });

      let query = db
        .selectFrom("posts")
        .selectAll()
        .where("userId", "=", userId);

      if (q) {
        const pattern = `%${escapeLikePattern(q)}%`;
        query = query.where((eb) =>
          eb("title", "ilike", pattern).or("content", "ilike", pattern),
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
      const countResult = yield* db.executeTakeFirstOrUndefined(countQuery);
      const totalCount = Number(countResult?.count ?? 0);

      const pagination = computePagination(totalCount, {
        page,
        pageSize: PAGE_SIZE,
      });

      query = query.orderBy("id", "desc");

      const items = yield* db.execute(
        query.offset(pagination.offset).limit(PAGE_SIZE),
      );

      const posts = yield* Effect.try({
        try: () => parse(Schema.Array(postsSelectSchema))(items),
        catch: (error) =>
          new ValidationError({
            message: "Error processing user posts",
            cause: error,
          }),
      });

      const voteCounts = yield* fetchPostVoteCounts(
        db,
        posts.map((post) => post.id),
      );
      const postsWithVotes = yield* Effect.try({
        try: () =>
          parse(Schema.Array(postWithVotesSelectSchema))(
            posts.map((post) => {
              const counts = voteCounts.get(post.id) ?? {
                dislikes: 0,
                likes: 0,
              };
              return {
                ...post,
                dislikes: counts.dislikes,
                likes: counts.likes,
              };
            }),
          ),
        catch: (error) =>
          new ValidationError({
            message: "Error processing user post vote counts",
            cause: error,
          }),
      });

      const popularTagsResult = yield* db.execute(
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
          .limit(10),
      );

      return {
        data: postsWithVotes,
        meta: {
          pagination,
          popularTags: mapPopularTags(popularTagsResult),
        },
        user: userInfo,
      };
    });

    return { all, userPosts };
  }),
}) {
  static readonly all = Effect.fn("UsersService.all")(function* () {
    const svc = yield* UsersService;
    return yield* svc.all();
  });

  static readonly userPosts = Effect.fn("UsersService.userPosts")(function* (
    data: Schema.Schema.Type<typeof fetchUserInputSchema>,
  ) {
    const svc = yield* UsersService;
    return yield* svc.userPosts(data);
  });
}

export const UsersServiceLive = Layer.effect(UsersService, UsersService.make);

export const fetchUsers = createServerFn().handler(
  createHandler(UsersServiceLive, baseLayerFactories.db)(UsersService.all),
);

export const fetchUserPosts = createServerFn()
  .validator(parseStrict(fetchUserInputSchema))
  .handler(
    createHandler(
      UsersServiceLive,
      baseLayerFactories.db,
    )(UsersService.userPosts),
  );
