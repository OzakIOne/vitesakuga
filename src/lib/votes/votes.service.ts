import { createServerFn } from "@tanstack/react-start";
import { Context, Effect, Layer, Option, Schema } from "effect";

import type { AuthServices } from "../auth/context";
import {
  getUserSessionEffect,
  SessionFetchError,
} from "../auth/session.effect";
import { KyselyDB } from "../db/context";
import type { PostVote } from "../db/schema";
import { SqlError } from "../effect/effect.utils";
import { parse, parseStrict } from "../effect/schema.utils";
import { PostNotFoundError, UnauthorizedError } from "../errors";
import { baseLayerFactories, createHandler } from "../server-fn.handler";
import {
  removePostVoteSchema,
  setPostVoteSchema,
  type RemovePostVoteInput,
  type SetPostVoteInput,
} from "./votes.schema";

export type PostVotesSummary = {
  dislikes: number;
  likes: number;
  userVote: PostVote | null;
};

export class PostVotesService extends Context.Service<
  PostVotesService,
  {
    readonly get: (
      postId: number,
    ) => Effect.Effect<
      PostVotesSummary,
      SessionFetchError | SqlError,
      AuthServices
    >;
    readonly set: (
      data: SetPostVoteInput,
    ) => Effect.Effect<
      PostVotesSummary,
      UnauthorizedError | PostNotFoundError | SessionFetchError | SqlError,
      AuthServices
    >;
    readonly remove: (
      data: RemovePostVoteInput,
    ) => Effect.Effect<
      PostVotesSummary,
      UnauthorizedError | SessionFetchError | SqlError,
      AuthServices
    >;
  }
>()("PostVotesService", {
  make: Effect.gen(function* () {
    const db = yield* KyselyDB;

    const fetchSummary = Effect.fn("PostVotesService.fetchSummary")(function* (
      postId: number,
      userId: string | null,
    ) {
      const counts = yield* db.executeTakeFirstOrUndefined(
        db
          .selectFrom("post_votes")
          .select((eb) => [
            eb.fn.countAll().filterWhere("vote", "=", "like").as("likes"),
            eb.fn.countAll().filterWhere("vote", "=", "dislike").as("dislikes"),
          ])
          .where("postId", "=", postId),
      );

      const userVote = userId
        ? yield* db.executeTakeFirstOrUndefined(
            db
              .selectFrom("post_votes")
              .select("vote")
              .where("postId", "=", postId)
              .where("userId", "=", userId),
          )
        : undefined;

      return {
        dislikes: Number(counts?.dislikes ?? 0),
        likes: Number(counts?.likes ?? 0),
        userVote: userVote?.vote ?? null,
      };
    });

    const get = Effect.fn("PostVotesService.get")(function* (postId: number) {
      const user = yield* getUserSessionEffect();
      return yield* fetchSummary(postId, user?.id ?? null);
    });

    const set = Effect.fn("PostVotesService.set")(function* (
      data: SetPostVoteInput,
    ) {
      const session = yield* getUserSessionEffect();

      if (!session) {
        return yield* Effect.fail(
          new UnauthorizedError({
            message: "You must be logged in to vote on posts",
          }),
        );
      }

      const postOption = yield* db.executeTakeFirstOption(
        db.selectFrom("posts").select("id").where("id", "=", data.postId),
      );

      yield* Option.match(postOption, {
        onNone: () =>
          Effect.fail(
            new PostNotFoundError({
              message: `Post ${data.postId} not found`,
              postId: data.postId,
            }),
          ),
        onSome: () => Effect.succeed(undefined),
      });

      yield* db.execute(
        db
          .insertInto("post_votes")
          .values({ postId: data.postId, userId: session.id, vote: data.vote })
          .onConflict((oc) =>
            oc.columns(["postId", "userId"]).doUpdateSet({ vote: data.vote }),
          ),
      );

      yield* Effect.logInfo("Post vote set").pipe(
        Effect.annotateLogs({
          postId: String(data.postId),
          userId: session.id,
          vote: data.vote,
        }),
      );

      return yield* fetchSummary(data.postId, session.id);
    });

    const remove = Effect.fn("PostVotesService.remove")(function* (
      data: RemovePostVoteInput,
    ) {
      const session = yield* getUserSessionEffect();

      if (!session) {
        return yield* Effect.fail(
          new UnauthorizedError({
            message: "You must be logged in to vote on posts",
          }),
        );
      }

      yield* db.execute(
        db
          .deleteFrom("post_votes")
          .where("postId", "=", data.postId)
          .where("userId", "=", session.id),
      );

      yield* Effect.logInfo("Post vote removed").pipe(
        Effect.annotateLogs({
          postId: String(data.postId),
          userId: session.id,
        }),
      );

      return yield* fetchSummary(data.postId, session.id);
    });

    return { get, set, remove };
  }),
}) {
  static readonly get = Effect.fn("PostVotesService.get")(function* (
    postId: number,
  ) {
    const svc = yield* PostVotesService;
    return yield* svc.get(postId);
  });

  static readonly set = Effect.fn("PostVotesService.set")(function* (
    data: SetPostVoteInput,
  ) {
    const svc = yield* PostVotesService;
    return yield* svc.set(data);
  });

  static readonly remove = Effect.fn("PostVotesService.remove")(function* (
    data: RemovePostVoteInput,
  ) {
    const svc = yield* PostVotesService;
    return yield* svc.remove(data);
  });
}

export const PostVotesServiceLive = Layer.effect(
  PostVotesService,
  PostVotesService.make,
);

export const fetchPostVotes = createServerFn({ strict: { output: false } })
  .validator(parse(Schema.Number))
  .handler(
    createHandler(
      PostVotesService.get,
      PostVotesServiceLive,
      baseLayerFactories.auth,
    ),
  );

export const setPostVote = createServerFn({ method: "POST" })
  .validator(parseStrict(setPostVoteSchema))
  .handler(
    createHandler(
      PostVotesService.set,
      PostVotesServiceLive,
      baseLayerFactories.auth,
    ),
  );

export const removePostVote = createServerFn({ method: "POST" })
  .validator(parseStrict(removePostVoteSchema))
  .handler(
    createHandler(
      PostVotesService.remove,
      PostVotesServiceLive,
      baseLayerFactories.auth,
    ),
  );
