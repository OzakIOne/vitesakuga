import { Effect, Layer } from "effect";
import type { Kysely } from "kysely";
import { describe, expect, it } from "vitest";

import {
  CommentsServiceLive,
  CommentsService,
} from "../comments/comments.service";
import type { DB } from "../db/kysely";
import { makeServiceTestLayer } from "../db/test-utils";
import { asPlaylistId, asPostId } from "../ids";
import {
  ModerationServiceLive,
  ModerationService,
} from "../moderation/moderation.service";
import {
  PlaylistsServiceLive,
  PlaylistsService,
} from "../playlists/playlists.service";
import type { PostEditPayload } from "../post-edits/post-edits.schema";
import {
  PostEditsServiceLive,
  PostEditsService,
} from "../post-edits/post-edits.service";
import { PostsServiceLive, PostsService } from "../posts/posts.service";
import {
  PromotionsServiceLive,
  PromotionsService,
} from "../promotions/promotions.service";
import {
  PostReportsServiceLive,
  PostReportsService,
} from "../reports/reports.service";
import { VideosServiceLive, VideosService } from "../videos/videos.service";
import { PostVotesServiceLive, PostVotesService } from "../votes/votes.service";
import { SessionService } from "./session.effect";
import { makeAuthSession } from "./session.fixture";

const MATRIX_LIVE = Layer.mergeAll(
  PostsServiceLive,
  CommentsServiceLive,
  PostEditsServiceLive,
  PostVotesServiceLive,
  PostReportsServiceLive,
  PromotionsServiceLive,
  ModerationServiceLive,
  VideosServiceLive,
  PlaylistsServiceLive,
);

type MatrixServices = Layer.Success<typeof MATRIX_LIVE>;

type Actor = "anonymous" | "novice" | "uploader" | "moderator" | "admin";
type Outcome = "allowed" | "denied";

/** `own`: the actor owns the resource; `others`: a novice author owns it. */
type Ownership = "own" | "others" | "any";

const ACTOR_USER_IDS = {
  admin: "admin-user",
  moderator: "moderator-user",
  novice: "novice-user",
  uploader: "uploader-user",
} as const satisfies Partial<Record<Actor, string>>;

const AUTHOR_ID = "author-user";
const SUGGESTER_ID = "suggester-user";
const CANDIDATE_ID = "candidate-user";
const POST_ID = asPostId(1);

const SIGNED_IN: ReadonlyArray<Actor> = [
  "novice",
  "uploader",
  "moderator",
  "admin",
];
const UPLOADER_OR_UP: ReadonlyArray<Actor> = ["uploader", "moderator", "admin"];
const STAFF: ReadonlyArray<Actor> = ["moderator", "admin"];
const ADMIN_ONLY: ReadonlyArray<Actor> = ["admin"];
const NOBODY: ReadonlyArray<Actor> = [];

const AUTHZ_DENIALS: ReadonlyArray<string> = [
  "ForbiddenError",
  "UnauthorizedError",
];
const HIDDEN_PLAYLIST_DENIALS: ReadonlyArray<string> = [
  ...AUTHZ_DENIALS,
  "PlaylistNotFoundError",
];

const PAYLOAD: PostEditPayload = {
  description: "improved description",
  title: "Improved title",
};

const USER_ROWS = [
  { id: ACTOR_USER_IDS.admin, role: "admin" },
  { id: ACTOR_USER_IDS.moderator, role: "moderator" },
  { id: ACTOR_USER_IDS.uploader, role: "uploader" },
  { id: ACTOR_USER_IDS.novice, role: "novice" },
  { id: AUTHOR_ID, role: "novice" },
  { id: SUGGESTER_ID, role: "uploader" },
  { id: CANDIDATE_ID, role: "novice" },
] as const;

const actorId = (actor: Actor): string | null =>
  actor === "anonymous" ? null : ACTOR_USER_IDS[actor];

/** Owner of the seeded post, comment and playlist for one ownership case. */
const resourceOwnerId = (actor: Actor, ownership: Ownership): string =>
  ownership === "own" && actor !== "anonymous"
    ? ACTOR_USER_IDS[actor]
    : AUTHOR_ID;

const seedWorld = async (db: Kysely<DB>, ownerId: string) => {
  await db
    .insertInto("user")
    .values(
      USER_ROWS.map((row) => ({
        email: `${row.id}@test.com`,
        id: row.id,
        name: row.id,
        role: row.role,
        username: row.id,
      })),
    )
    .execute();
  await db
    .insertInto("posts")
    .values({
      description: "original description",
      id: 1,
      thumbnailKey: "thumb-1.jpg",
      title: "Original title",
      userId: ownerId,
      videoKey: null,
      videoMetadata: "{}",
    })
    .execute();
  await db
    .insertInto("comments")
    .values({ content: "original comment", postId: POST_ID, userId: ownerId })
    .execute();
  const edit = await db
    .insertInto("post_edits")
    .values({
      payload: PAYLOAD,
      postId: POST_ID,
      previous_payload: {
        animeTitle: null,
        chapterNumber: null,
        description: "original description",
        episodeNumber: null,
        seasonNumber: null,
        source: null,
        title: "Original title",
        volumeNumber: null,
      },
      status: "pending",
      suggestedBy: SUGGESTER_ID,
    })
    .returning("id")
    .executeTakeFirstOrThrow();
  const playlist = await db
    .insertInto("playlists")
    .values({ is_public: false, title: "Private", user_id: ownerId })
    .returning("id")
    .executeTakeFirstOrThrow();
  return {
    commentId: 1,
    editId: edit.id,
    playlistId: asPlaylistId(playlist.id),
  };
};

type World = Awaited<ReturnType<typeof seedWorld>>;

type Operation = {
  readonly name: string;
  /** Actors allowed to run it, keyed by which resource the actor touches. */
  readonly allowed: Partial<Record<Ownership, ReadonlyArray<Actor>>>;
  readonly denials?: ReadonlyArray<string>;
  readonly run: (
    world: World,
  ) => Effect.Effect<unknown, unknown, MatrixServices | SessionService>;
};

const UPLOAD_INPUT = {
  description: "<p>Test upload</p>",
  relatedPostId: undefined,
  source: undefined,
  tags: [],
  thumbnail: new File(["thumb"], "thumb.jpg", { type: "image/jpeg" }),
  title: "Uploaded Post",
  videoKey: "videos/user-1/a.mp4",
  videoMetadata: undefined,
};

const POST_UPDATE_INPUT = {
  animeTitle: null,
  chapterNumber: null,
  description: "updated description",
  episodeNumber: null,
  expectedVersion: 0,
  operationKey: "matrix-update",
  postId: POST_ID,
  seasonNumber: null,
  sourceType: null,
  tags: [],
  title: "Updated title",
  volumeNumber: null,
};

const OPERATIONS: ReadonlyArray<Operation> = [
  {
    name: "posts.upload",
    allowed: { any: SIGNED_IN },
    run: () =>
      Effect.flatMap(PostsService, (service) => service.upload(UPLOAD_INPUT)),
  },
  {
    name: "posts.update",
    allowed: { own: SIGNED_IN, others: STAFF },
    run: () =>
      Effect.flatMap(PostsService, (service) =>
        service.update(POST_UPDATE_INPUT),
      ),
  },
  {
    name: "comments.add",
    allowed: { any: SIGNED_IN },
    run: () =>
      Effect.flatMap(CommentsService, (service) =>
        service.add({ content: "Nice!", postId: POST_ID }),
      ),
  },
  {
    name: "comments.update",
    allowed: { own: SIGNED_IN, others: STAFF },
    run: (world) =>
      Effect.flatMap(CommentsService, (service) =>
        service.update({ commentId: world.commentId, content: "Edited" }),
      ),
  },
  {
    name: "comments.delete",
    allowed: { own: SIGNED_IN, others: STAFF },
    run: (world) =>
      Effect.flatMap(CommentsService, (service) =>
        service.delete_({ commentId: world.commentId }),
      ),
  },
  {
    name: "votes.set",
    allowed: { any: SIGNED_IN },
    run: () =>
      Effect.flatMap(PostVotesService, (service) =>
        service.set({ postId: POST_ID, vote: "like" }),
      ),
  },
  {
    name: "reports.submit",
    allowed: { any: SIGNED_IN },
    run: () =>
      Effect.flatMap(PostReportsService, (service) =>
        service.submit({ postId: POST_ID, reason: "duplicate" }),
      ),
  },
  {
    name: "edits.propose",
    allowed: { others: UPLOADER_OR_UP },
    run: () =>
      Effect.flatMap(PostEditsService, (service) =>
        service.propose({ payload: PAYLOAD, postId: POST_ID }),
      ),
  },
  {
    name: "edits.approve",
    allowed: { others: UPLOADER_OR_UP },
    run: (world) =>
      Effect.flatMap(PostEditsService, (service) =>
        service.approve({
          editId: world.editId,
          operationKey: "matrix-approve",
        }),
      ),
  },
  {
    name: "edits.reject",
    allowed: { others: STAFF },
    run: (world) =>
      Effect.flatMap(PostEditsService, (service) =>
        service.reject({ editId: world.editId }),
      ),
  },
  {
    name: "promotions.queue",
    allowed: { any: STAFF },
    run: () => Effect.flatMap(PromotionsService, (service) => service.queue()),
  },
  {
    name: "promotions.approve",
    allowed: { any: STAFF },
    run: () =>
      Effect.flatMap(PromotionsService, (service) =>
        service.approve({ userId: CANDIDATE_ID }),
      ),
  },
  {
    name: "promotions.reject",
    allowed: { any: STAFF },
    run: () =>
      Effect.flatMap(PromotionsService, (service) =>
        service.reject({ userId: CANDIDATE_ID }),
      ),
  },
  {
    name: "reports.review (moderation overview)",
    allowed: { any: STAFF },
    run: () =>
      Effect.flatMap(ModerationService, (service) => service.overview()),
  },
  {
    name: "roles.assign",
    allowed: { any: ADMIN_ONLY },
    run: () =>
      Effect.flatMap(ModerationService, (service) =>
        service.setUserRole({ role: "uploader", userId: CANDIDATE_ID }),
      ),
  },
  {
    name: "storage.gc preview",
    allowed: { any: ADMIN_ONLY },
    run: () => Effect.flatMap(VideosService, (service) => service.gcPreview()),
  },
  {
    name: "storage.gc run",
    allowed: { any: ADMIN_ONLY },
    run: () => Effect.flatMap(VideosService, (service) => service.gcRun()),
  },
  {
    name: "videos.listRevisions",
    allowed: { own: SIGNED_IN, others: STAFF },
    run: () =>
      Effect.flatMap(VideosService, (service) =>
        service.listRevisions(POST_ID),
      ),
  },
  {
    name: "playlists.fetchDetail (private)",
    allowed: { own: SIGNED_IN, others: NOBODY },
    denials: HIDDEN_PLAYLIST_DENIALS,
    run: (world) =>
      Effect.flatMap(PlaylistsService, (service) =>
        service.fetchDetail({ playlistId: world.playlistId, page: 0 }),
      ),
  },
  {
    name: "playlists.delete (owner only)",
    allowed: { own: SIGNED_IN, others: NOBODY },
    run: (world) =>
      Effect.flatMap(PlaylistsService, (service) =>
        service.delete_({ playlistId: world.playlistId }),
      ),
  },
];

const ALL_ACTORS: ReadonlyArray<Actor> = [
  "anonymous",
  "novice",
  "uploader",
  "moderator",
  "admin",
];

type Scenario = {
  readonly name: string;
  readonly actor: Actor;
  readonly ownership: Ownership;
  readonly expected: Outcome;
  readonly operation: Operation;
};

/**
 * One row per (operation, actor, ownership). Ownership keys come from the
 * allow-table, so an operation that does not depend on the resource owner
 * produces only the `any` rows.
 */
const scenarios: ReadonlyArray<Scenario> = OPERATIONS.flatMap((operation) =>
  (Object.keys(operation.allowed) as Ownership[]).flatMap((ownership) =>
    ALL_ACTORS.filter(
      (actor) => !(actor === "anonymous" && ownership === "own"),
    ).map((actor) => {
      const permitted = operation.allowed[ownership] ?? [];
      return {
        actor,
        expected: permitted.includes(actor) ? "allowed" : "denied",
        name: `${operation.name} | ${actor} | ${ownership}`,
        operation,
        ownership,
      } satisfies Scenario;
    }),
  ),
);

const actorSession = (actor: Actor) => {
  const id = actorId(actor);
  if (id === null) {
    return null;
  }
  return makeAuthSession({ id, role: actor, username: id });
};

const hasTag = (error: unknown): error is { readonly _tag: string } =>
  typeof error === "object" && error !== null && "_tag" in error;

/**
 * `denied` when the service refused on authorization grounds; `allowed` when
 * it proceeded past the gate (it may still fail on business rules).
 */
const outcomeOf =
  (denials: ReadonlyArray<string>) =>
  (effect: Effect.Effect<unknown, unknown, MatrixServices | SessionService>) =>
    effect.pipe(
      Effect.match({
        onFailure: (error): Outcome =>
          hasTag(error) && denials.includes(error._tag) ? "denied" : "allowed",
        onSuccess: (): Outcome => "allowed",
      }),
    );

describe("authorization matrix (characterization)", () => {
  it.each(scenarios)("$name", async (scenario) => {
    const isGcOperation = scenario.operation.name.startsWith("storage.gc");
    const ctx = await makeServiceTestLayer(
      MATRIX_LIVE,
      isGcOperation
        ? {
            wrapStorage: (storage) => ({
              ...storage,
              listKeys: () => Effect.succeed([]),
            }),
          }
        : {},
    );
    try {
      const ownerId = resourceOwnerId(scenario.actor, scenario.ownership);
      const world = await seedWorld(ctx.db, ownerId);
      ctx.mockGetSession.mockResolvedValue(actorSession(scenario.actor));
      const outcome = await ctx.runEffect(
        outcomeOf(scenario.operation.denials ?? AUTHZ_DENIALS)(
          scenario.operation.run(world),
        ),
      );
      expect(outcome).toBe(scenario.expected);
    } finally {
      await ctx.close();
    }
  });
});
