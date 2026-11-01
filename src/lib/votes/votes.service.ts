import { createServerFn } from "@tanstack/react-start";
import { Context, Effect, Layer, Option, Schema } from "effect";

import {
  CommunityActivityService,
  CommunityActivityServiceLive,
} from "../activity/community-activity.service";
import { SessionFetchError, SessionService } from "../auth/session.effect";
import { KyselyDB } from "../db/context";
import { SqlError } from "../db/effect-kysely";
import type { PostVote } from "../db/schema";
import { toIsoTimestamp } from "../db/schema/timestamp";
import { parse, parseStrict } from "../effect/schema.utils";
import {
  AccountSuspendedError,
  ForbiddenError,
  PostNotFoundError,
  UnauthorizedError,
} from "../errors";
import { asPostId, PostId } from "../ids";
import {
  computePagination,
  type PaginationMeta,
} from "../pagination/pagination";
import { createEndpointHandler } from "../server-endpoint";
import { baseLayerFactories } from "../server-fn.handler";
import {
  fetchLikedPostsSchema,
  removePostVoteSchema,
  setPostVoteSchema,
  type FetchLikedPostsInput,
  type RemovePostVoteInput,
  type SetPostVoteInput,
} from "./votes.schema";

export type PostVotesSummary = {
  dislikes: number;
  likes: number;
  userVote: PostVote | null;
};

const LIKED_POSTS_PAGE_SIZE = 30;
const LIKED_PLAYLIST_TITLE = "Liked posts";

// A liked post row mirrors the playlist detail row shape so the same grid UI
// can render regular playlists and the virtual "Liked posts" playlist.
type LikedPostRow = {
  post_id: number;
  position: number;
  /** ISO timestamp string — `Date` does not survive the JSON server-function transport. */
  added_at: string;
  id: number;
  title: string;
  description: string;
  thumbnail_key: string;
  /** ISO timestamp string — `Date` does not survive the JSON server-function transport. */
  created_at: string;
  user_id: string | null;
  user_name: string | null;
  video_key: string | null;
};

type LikedPlaylistMeta = {
  title: string;
  description: string | null;
  is_public: boolean;
  post_count: number;
  thumbnail_key: string | null;
};

export type LikedPostsResult = {
  playlist: LikedPlaylistMeta;
  data: readonly LikedPostRow[];
  meta: { pagination: PaginationMeta };
};

export class PostVotesService extends Context.Service<
  PostVotesService,
  {
    readonly get: (
      postId: number,
    ) => Effect.Effect<
      PostVotesSummary,
      SessionFetchError | SqlError,
      SessionService
    >;
    readonly set: (
      data: SetPostVoteInput,
    ) => Effect.Effect<
      PostVotesSummary,
      | AccountSuspendedError
      | ForbiddenError
      | UnauthorizedError
      | PostNotFoundError
      | SessionFetchError
      | SqlError,
      SessionService
    >;
    readonly remove: (
      data: RemovePostVoteInput,
    ) => Effect.Effect<
      PostVotesSummary,
      | AccountSuspendedError
      | ForbiddenError
      | UnauthorizedError
      | SessionFetchError
      | SqlError,
      SessionService
    >;
    readonly fetchLikedPosts: (
      data: FetchLikedPostsInput,
    ) => Effect.Effect<
      LikedPostsResult,
      | AccountSuspendedError
      | ForbiddenError
      | UnauthorizedError
      | SessionFetchError
      | SqlError,
      SessionService
    >;
  }
>()("PostVotesService", {
  make: Effect.gen(function* () {
    const db = yield* KyselyDB;
    const community = yield* CommunityActivityService;

    const fetchSummary = Effect.fn("PostVotesService.fetchSummary")(function* (
      postId: PostId,
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

    const get = Effect.fn("PostVotesService.get")(function* (
      rawPostId: number,
    ) {
      const postId = asPostId(rawPostId);
      const sessions = yield* SessionService;
      const user = yield* sessions.getUser();
      return yield* fetchSummary(postId, user?.id ?? null);
    });

    const set = Effect.fn("PostVotesService.set")(function* (
      data: SetPostVoteInput,
    ) {
      const sessions = yield* SessionService;
      const session = yield* sessions.requireActor(
        "You must be logged in to vote on posts",
      );

      const postOption = yield* db.executeTakeFirstOption(
        db
          .selectFrom("posts")
          .select(["id", "userId"])
          .where("id", "=", data.postId),
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

      if (Option.isSome(postOption) && data.vote === "like") {
        yield* community.record({
          _tag: "LikeReceived",
          authorId: postOption.value.userId,
          postId: data.postId,
          voterId: session.id,
        });
      }

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
      const sessions = yield* SessionService;
      const session = yield* sessions.requireActor(
        "You must be logged in to vote on posts",
      );

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

    // Virtual "Liked posts" playlist (YouTube-style): derived directly from the
    // user's like votes instead of stored playlist rows, so it can never drift
    // out of sync with what the user actually liked.
    const fetchLikedPosts = Effect.fn("PostVotesService.fetchLikedPosts")(
      function* (data: FetchLikedPostsInput) {
        const sessions = yield* SessionService;
        const session = yield* sessions.requireReadActor(
          "You must be logged in to view your liked posts",
        );

        const countResult = yield* db.executeTakeFirstOrUndefined(
          db
            .selectFrom("post_votes")
            .select(db.fn.countAll().as("count"))
            .where("userId", "=", session.id)
            .where("vote", "=", "like"),
        );
        const totalCount = Number(countResult?.count ?? 0);

        const pagination = computePagination(totalCount, {
          page: data.page,
          pageSize: LIKED_POSTS_PAGE_SIZE,
        });

        // Inner join on posts is enough: post_votes.postId cascades on post
        // deletion, so a vote can never reference a deleted post.
        const rows = yield* db.execute(
          db
            .selectFrom("post_votes")
            .innerJoin("posts", "posts.id", "post_votes.postId")
            .leftJoin("user", "user.id", "posts.userId")
            .select([
              "post_votes.postId as post_id",
              "post_votes.createdAt as added_at",
              "posts.id",
              "posts.title",
              "posts.description",
              "posts.thumbnailKey as thumbnail_key",
              "posts.createdAt as created_at",
              "posts.userId as user_id",
              "posts.videoKey as video_key",
              "user.name as user_name",
            ] as const)
            .where("post_votes.userId", "=", session.id)
            .where("post_votes.vote", "=", "like")
            .orderBy("post_votes.createdAt", "desc")
            // Stable tie-breaker when two likes share the same timestamp.
            .orderBy("post_votes.postId", "desc")
            .offset(pagination.offset)
            .limit(LIKED_POSTS_PAGE_SIZE),
        );

        const likedRows: LikedPostRow[] = rows.map((row, index) => ({
          added_at: toIsoTimestamp(row.added_at),
          description: row.description,
          created_at: toIsoTimestamp(row.created_at),
          id: row.id,
          position: pagination.offset + index,
          post_id: row.post_id,
          thumbnail_key: row.thumbnail_key,
          title: row.title,
          user_id: row.user_id,
          user_name: row.user_name,
          video_key: row.video_key,
        }));

        return {
          playlist: {
            description: null,
            is_public: false,
            post_count: totalCount,
            thumbnail_key: likedRows[0]?.thumbnail_key ?? null,
            title: LIKED_PLAYLIST_TITLE,
          },
          data: likedRows,
          meta: { pagination },
        };
      },
    );

    return { get, set, remove, fetchLikedPosts };
  }),
}) {}

export const PostVotesServiceLive = Layer.effect(
  PostVotesService,
  PostVotesService.make,
).pipe(Layer.provideMerge(CommunityActivityServiceLive));

export const fetchPostVotes = createServerFn({ strict: { output: false } })
  // Scalar payloads stay unbranded on the wire; the service brands the id on entry.
  .validator(parse(Schema.Number))
  .handler(
    createEndpointHandler({
      service: PostVotesService,
      operation: "get",
      layer: PostVotesServiceLive,
      base: baseLayerFactories.auth,
    }),
  );

export const setPostVote = createServerFn({ method: "POST" })
  .validator(parseStrict(setPostVoteSchema))
  .handler(
    createEndpointHandler({
      service: PostVotesService,
      operation: "set",
      layer: PostVotesServiceLive,
      base: baseLayerFactories.auth,
    }),
  );

export const removePostVote = createServerFn({ method: "POST" })
  .validator(parseStrict(removePostVoteSchema))
  .handler(
    createEndpointHandler({
      service: PostVotesService,
      operation: "remove",
      layer: PostVotesServiceLive,
      base: baseLayerFactories.auth,
    }),
  );

export const fetchLikedPosts = createServerFn({
  strict: { output: false },
})
  .validator(parseStrict(fetchLikedPostsSchema))
  .handler(
    createEndpointHandler({
      service: PostVotesService,
      operation: "fetchLikedPosts",
      layer: PostVotesServiceLive,
      base: baseLayerFactories.auth,
    }),
  );
