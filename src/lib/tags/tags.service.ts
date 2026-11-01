import { createServerFn } from "@tanstack/react-start";
import { Context, Effect, Layer, Option, Schema } from "effect";

import { SessionFetchError, SessionService } from "../auth/session.effect";
import { KyselyDB } from "../db/context";
import { SqlError } from "../db/effect-kysely";
import { parseStrict } from "../effect/schema.utils";
import { AccountSuspendedError, ForbiddenError, UnauthorizedError, ValidationError } from "../errors";
import { createEndpointHandler } from "../server-endpoint";
import { baseLayerFactories } from "../server-fn.handler";
import { setTagFollowedSchema, tagFollowStateSchema } from "./tags.schema";
import { mapPopularTags } from "./tags.utils";

export class TagsService extends Context.Service<
  TagsService,
  {
    readonly all: () => Effect.Effect<{ id: number; name: string }[], SqlError>;
    readonly popular: () => Effect.Effect<
      ReturnType<typeof mapPopularTags>,
      SqlError
    >;
    readonly getFollowState: (
      data: Schema.Schema.Type<typeof tagFollowStateSchema>,
    ) => Effect.Effect<
      { readonly followed: boolean; readonly tagName: string },
      SqlError | SessionFetchError,
      SessionService
    >;
    readonly setFollowed: (
      data: Schema.Schema.Type<typeof setTagFollowedSchema>,
    ) => Effect.Effect<
      { readonly followed: boolean; readonly tagName: string },
      | SqlError
      | SessionFetchError
      | AccountSuspendedError
      | ForbiddenError
      | UnauthorizedError
      | ValidationError,
      SessionService
    >;
  }
>()("TagsService", {
  make: Effect.gen(function* () {
    const db = yield* KyselyDB;
    const sessions = yield* SessionService;

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

    const getFollowState = Effect.fn("TagsService.getFollowState")(function* (
      data: Schema.Schema.Type<typeof tagFollowStateSchema>,
    ) {
      const user = yield* sessions.getUser();
      if (user === null) {
        return { followed: false, tagName: data.tagName };
      }

      const tag = yield* db.executeTakeFirstOption(
        db.selectFrom("tags").select("id").where("name", "=", data.tagName),
      );
      if (Option.isNone(tag)) {
        return { followed: false, tagName: data.tagName };
      }

      const follow = yield* db.executeTakeFirstOption(
        db
          .selectFrom("tag_follows")
          .select("tagId")
          .where("tagId", "=", tag.value.id)
          .where("userId", "=", user.id),
      );

      return {
        followed: Option.isSome(follow),
        tagName: data.tagName,
      };
    });

    const setFollowed = Effect.fn("TagsService.setFollowed")(function* (
      data: Schema.Schema.Type<typeof setTagFollowedSchema>,
    ) {
      const user = yield* sessions.requireActor(
        "You must be logged in to follow tags",
      );
      const tag = yield* db.executeTakeFirstOption(
        db.selectFrom("tags").select("id").where("name", "=", data.tagName),
      );
      if (Option.isNone(tag)) {
        return yield* Effect.fail(
          new ValidationError({ message: "That tag does not exist" }),
        );
      }

      if (data.followed) {
        yield* db.execute(
          db
            .insertInto("tag_follows")
            .values({ tagId: tag.value.id, userId: user.id })
            .onConflict((oc) => oc.columns(["userId", "tagId"]).doNothing()),
        );
      } else {
        yield* db.execute(
          db
            .deleteFrom("tag_follows")
            .where("tagId", "=", tag.value.id)
            .where("userId", "=", user.id),
        );
      }

      return { followed: data.followed, tagName: data.tagName };
    });

    return { all, getFollowState, popular, setFollowed };
  }),
}) {}

export const TagsServiceLive = Layer.effect(TagsService, TagsService.make);

export const getAllTags = createServerFn().handler(
  createEndpointHandler({
    service: TagsService,
    operation: "all",
    layer: TagsServiceLive,
    base: baseLayerFactories.auth,
  }),
);

export const getAllPopularTags = createServerFn().handler(
  createEndpointHandler({
    service: TagsService,
    operation: "popular",
    layer: TagsServiceLive,
    base: baseLayerFactories.auth,
  }),
);

export const getTagFollowState = createServerFn({ strict: { output: false } })
  .validator(parseStrict(tagFollowStateSchema))
  .handler(
    createEndpointHandler({
      service: TagsService,
      operation: "getFollowState",
      layer: TagsServiceLive,
      base: baseLayerFactories.auth,
    }),
  );

export const setTagFollowed = createServerFn({
  method: "POST",
  strict: { output: false },
})
  .validator(parseStrict(setTagFollowedSchema))
  .handler(
    createEndpointHandler({
      service: TagsService,
      operation: "setFollowed",
      layer: TagsServiceLive,
      base: baseLayerFactories.auth,
    }),
  );
