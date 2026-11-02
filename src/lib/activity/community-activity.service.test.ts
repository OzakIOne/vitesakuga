import { Effect, Layer } from "effect";
import { sql, type Kysely } from "kysely";
import { afterEach, describe, expect, it } from "vitest";

import { KyselyDB } from "../db/context";
import { makeSqlError } from "../db/effect-kysely";
import type { DB } from "../db/kysely";
import { makeServiceTestLayer } from "../db/test-utils";
import {
  NotificationsService,
  NotificationsServiceLive,
} from "../notifications/notifications.service";
import { POINTS_RULES } from "../points/points.config";
import { PointsServiceLive } from "../points/points.service";
import {
  CommunityActivityService,
  CommunityActivityServiceLive,
  type CommentActivityEvent,
  type CommunityActivityEvent,
} from "./community-activity.service";

let closeCtx: (() => Promise<void>) | undefined;

afterEach(async () => {
  await closeCtx?.();
  closeCtx = undefined;
});

const seedUser = (
  db: Kysely<DB>,
  args: {
    readonly id: string;
    readonly username?: string;
    readonly deletedAt?: Date;
  },
) =>
  db
    .insertInto("user")
    .values({
      deletedAt: args.deletedAt ?? null,
      email: `${args.id}@test.com`,
      id: args.id,
      name: args.id,
      username: args.username ?? args.id,
    })
    .execute();

const seedPost = async (db: Kysely<DB>, userId: string) => {
  const post = await db
    .insertInto("posts")
    .values({
      description: "description",
      thumbnailKey: "thumb.jpg",
      title: "Title",
      userId,
      videoKey: "video.mp4",
      videoMetadata: {},
    })
    .returning("id")
    .executeTakeFirstOrThrow();
  return post.id;
};

const seedComment = async (
  db: Kysely<DB>,
  args: { readonly postId: number; readonly userId: string },
) => {
  const comment = await db
    .insertInto("comments")
    .values({ content: "text", postId: args.postId, userId: args.userId })
    .returning("id")
    .executeTakeFirstOrThrow();
  return comment.id;
};

const ledgerFor = (db: Kysely<DB>, userId: string) =>
  db
    .selectFrom("points_ledger")
    .select(["action", "actorId", "points", "refId"])
    .where("userId", "=", userId)
    .execute();

const inboxFor = (db: Kysely<DB>, userId: string) =>
  db
    .selectFrom("notifications")
    .select(["postId", "type"])
    .where("userId", "=", userId)
    .orderBy("id", "asc")
    .execute();

const mentionRowsFor = (db: Kysely<DB>, commentId: number) =>
  db
    .selectFrom("comment_mentions")
    .select("userId")
    .where("commentId", "=", commentId)
    .orderBy("userId", "asc")
    .execute();

const record = (event: CommunityActivityEvent) =>
  Effect.gen(function* () {
    const svc = yield* CommunityActivityService;
    return yield* svc.record(event);
  });

const totalPoints = (userId: string) =>
  Effect.gen(function* () {
    const svc = yield* CommunityActivityService;
    return yield* svc.totalPoints(userId);
  });

const canonicalizeCommentMentions = (args: {
  readonly authorId: string;
  readonly content: string;
}) =>
  Effect.gen(function* () {
    const svc = yield* CommunityActivityService;
    return yield* svc.canonicalizeCommentMentions(args);
  });

/** Runs a comment fact inside a real transaction, as the comment services do. */
const recordInTransaction = (event: CommentActivityEvent) =>
  Effect.gen(function* () {
    const effectDb = yield* KyselyDB;
    const svc = yield* CommunityActivityService;
    yield* effectDb.transaction((trx) => svc.recordInTransaction(trx, event));
  });

/**
 * Replaces only the inbox: the seam for "notification fails" without touching
 * the rest of the module.
 */
const failingInboxLayer = Layer.effect(
  CommunityActivityService,
  CommunityActivityService.make,
).pipe(
  Layer.provide(
    Layer.effect(
      NotificationsService,
      Effect.gen(function* () {
        const inbox = yield* NotificationsService;
        return {
          ...inbox,
          notify: () =>
            Effect.fail(
              makeSqlError({
                cause: new Error("inbox unavailable"),
                operation: "notifications.notify",
              }),
            ),
        };
      }),
    ).pipe(Layer.provide(NotificationsServiceLive)),
  ),
  Layer.provide(PointsServiceLive),
);

describe("CommunityActivityService.record", () => {
  it("PostUploaded credits the author with post-upload points", async () => {
    const ctx = await makeServiceTestLayer(CommunityActivityServiceLive);
    closeCtx = ctx.close;
    const { db, runEffect } = ctx;
    await seedUser(db, { id: "alice" });
    const postId = await seedPost(db, "alice");

    await runEffect(
      record({
        _tag: "PostUploaded",
        authorId: "alice",
        postId,
      }),
    );

    expect(await ledgerFor(db, "alice")).toEqual([
      {
        action: "post-upload",
        actorId: "alice",
        points: POINTS_RULES["post-upload"].points,
        refId: postId,
      },
    ]);
    expect(await inboxFor(db, "alice")).toEqual([]);
  });

  it("LikeReceived credits the author and never pays a self-like", async () => {
    const ctx = await makeServiceTestLayer(CommunityActivityServiceLive);
    closeCtx = ctx.close;
    const { db, runEffect } = ctx;
    await seedUser(db, { id: "alice" });
    await seedUser(db, { id: "bob" });
    const postId = await seedPost(db, "alice");

    await runEffect(
      record({
        _tag: "LikeReceived",
        authorId: "alice",
        postId,
        voterId: "alice",
      }),
    );
    expect(await ledgerFor(db, "alice")).toEqual([]);

    await runEffect(
      record({
        _tag: "LikeReceived",
        authorId: "alice",
        postId,
        voterId: "bob",
      }),
    );
    expect(await ledgerFor(db, "alice")).toEqual([
      {
        action: "post-like-received",
        actorId: "bob",
        points: POINTS_RULES["post-like-received"].points,
        refId: postId,
      },
    ]);
  });

  it("EditApproved pays the suggester and notifies owner and suggester", async () => {
    const ctx = await makeServiceTestLayer(CommunityActivityServiceLive);
    closeCtx = ctx.close;
    const { db, runEffect } = ctx;
    await seedUser(db, { id: "owner" });
    await seedUser(db, { id: "suggester" });
    const postId = await seedPost(db, "owner");

    await runEffect(
      record({
        _tag: "EditApproved",
        editId: 7,
        postId,
        postOwnerId: "owner",
        suggestedById: "suggester",
      }),
    );

    expect(await ledgerFor(db, "suggester")).toEqual([
      {
        action: "edit-suggestion-approved",
        actorId: null,
        points: POINTS_RULES["edit-suggestion-approved"].points,
        refId: 7,
      },
    ]);
    expect(await inboxFor(db, "owner")).toEqual([
      { postId, type: "edit-suggestion-applied" },
    ]);
    expect(await inboxFor(db, "suggester")).toEqual([
      { postId, type: "edit-suggestion-approved" },
    ]);
  });

  it("EditRejected notifies only the suggester and awards nothing", async () => {
    const ctx = await makeServiceTestLayer(CommunityActivityServiceLive);
    closeCtx = ctx.close;
    const { db, runEffect } = ctx;
    await seedUser(db, { id: "owner" });
    await seedUser(db, { id: "suggester" });
    const postId = await seedPost(db, "owner");

    await runEffect(
      record({
        _tag: "EditRejected",
        postId,
        suggestedById: "suggester",
      }),
    );

    expect(await inboxFor(db, "suggester")).toEqual([
      { postId, type: "edit-suggestion-rejected" },
    ]);
    expect(await inboxFor(db, "owner")).toEqual([]);
    expect(await ledgerFor(db, "suggester")).toEqual([]);
  });

  it("PromotionApproved and PromotionRejected notify the candidate", async () => {
    const ctx = await makeServiceTestLayer(CommunityActivityServiceLive);
    closeCtx = ctx.close;
    const { db, runEffect } = ctx;
    await seedUser(db, { id: "candidate" });

    await runEffect(
      record({
        _tag: "PromotionRejected",
        userId: "candidate",
      }),
    );
    await runEffect(
      record({
        _tag: "PromotionApproved",
        userId: "candidate",
      }),
    );

    expect(await inboxFor(db, "candidate")).toEqual([
      { postId: null, type: "promotion-rejected" },
      { postId: null, type: "promotion-approved" },
    ]);
  });

  it("totalPoints sums the ledger through the module", async () => {
    const ctx = await makeServiceTestLayer(CommunityActivityServiceLive);
    closeCtx = ctx.close;
    const { db, runEffect } = ctx;
    await seedUser(db, { id: "alice" });
    const postId = await seedPost(db, "alice");

    await runEffect(
      record({
        _tag: "PostUploaded",
        authorId: "alice",
        postId,
      }),
    );

    expect(await runEffect(totalPoints("alice"))).toBe(
      POINTS_RULES["post-upload"].points,
    );
  });
});

describe("CommunityActivityService.recordInTransaction", () => {
  it("CommentWritten writes mention rows, notifies each mention and credits the author", async () => {
    const ctx = await makeServiceTestLayer(CommunityActivityServiceLive);
    closeCtx = ctx.close;
    const { db, runEffect } = ctx;
    await seedUser(db, { id: "alice" });
    await seedUser(db, { id: "bob" });
    await seedUser(db, { id: "carol" });
    const postId = await seedPost(db, "alice");
    const commentId = await seedComment(db, { postId, userId: "alice" });

    await runEffect(
      recordInTransaction({
        _tag: "CommentWritten",
        authorId: "alice",
        commentId,
        mentionedUserIds: ["bob", "carol"],
        postId,
      }),
    );

    expect(await mentionRowsFor(db, commentId)).toEqual([
      { userId: "bob" },
      { userId: "carol" },
    ]);
    expect(await inboxFor(db, "bob")).toEqual([
      { postId, type: "comment-mention" },
    ]);
    expect(await inboxFor(db, "carol")).toEqual([
      { postId, type: "comment-mention" },
    ]);
    expect(await ledgerFor(db, "alice")).toEqual([
      {
        action: "comment-written",
        actorId: "alice",
        points: POINTS_RULES["comment-written"].points,
        refId: commentId,
      },
    ]);
  });

  it("CommentEdited notifies only users newly added by the edit", async () => {
    const ctx = await makeServiceTestLayer(CommunityActivityServiceLive);
    closeCtx = ctx.close;
    const { db, runEffect } = ctx;
    await seedUser(db, { id: "alice" });
    await seedUser(db, { id: "bob" });
    await seedUser(db, { id: "carol" });
    const postId = await seedPost(db, "alice");
    const commentId = await seedComment(db, { postId, userId: "alice" });

    await runEffect(
      recordInTransaction({
        _tag: "CommentWritten",
        authorId: "alice",
        commentId,
        mentionedUserIds: ["bob"],
        postId,
      }),
    );
    await runEffect(
      recordInTransaction({
        _tag: "CommentEdited",
        commentId,
        mentionedUserIds: ["bob", "carol"],
        postId,
      }),
    );

    expect(await mentionRowsFor(db, commentId)).toEqual([
      { userId: "bob" },
      { userId: "carol" },
    ]);
    expect(await inboxFor(db, "bob")).toHaveLength(1);
    expect(await inboxFor(db, "carol")).toEqual([
      { postId, type: "comment-mention" },
    ]);
  });

  it("CommentEdited does not re-notify a mention that survives the edit", async () => {
    const ctx = await makeServiceTestLayer(CommunityActivityServiceLive);
    closeCtx = ctx.close;
    const { db, runEffect } = ctx;
    await seedUser(db, { id: "alice" });
    await seedUser(db, { id: "bob" });
    const postId = await seedPost(db, "alice");
    const commentId = await seedComment(db, { postId, userId: "alice" });

    await runEffect(
      recordInTransaction({
        _tag: "CommentWritten",
        authorId: "alice",
        commentId,
        mentionedUserIds: ["bob"],
        postId,
      }),
    );
    await runEffect(
      recordInTransaction({
        _tag: "CommentEdited",
        commentId,
        mentionedUserIds: ["bob"],
        postId,
      }),
    );

    expect(await mentionRowsFor(db, commentId)).toEqual([{ userId: "bob" }]);
    expect(await inboxFor(db, "bob")).toHaveLength(1);
  });

  it("CommentEdited deletes the row of a removed mention without notifying", async () => {
    const ctx = await makeServiceTestLayer(CommunityActivityServiceLive);
    closeCtx = ctx.close;
    const { db, runEffect } = ctx;
    await seedUser(db, { id: "alice" });
    await seedUser(db, { id: "bob" });
    const postId = await seedPost(db, "alice");
    const commentId = await seedComment(db, { postId, userId: "alice" });

    await runEffect(
      recordInTransaction({
        _tag: "CommentWritten",
        authorId: "alice",
        commentId,
        mentionedUserIds: ["bob"],
        postId,
      }),
    );
    await runEffect(
      recordInTransaction({
        _tag: "CommentEdited",
        commentId,
        mentionedUserIds: [],
        postId,
      }),
    );

    expect(await mentionRowsFor(db, commentId)).toEqual([]);
    expect(await inboxFor(db, "bob")).toHaveLength(1);
  });

  it("caps mentions at 10 per comment when canonicalizing", async () => {
    const ctx = await makeServiceTestLayer(CommunityActivityServiceLive);
    closeCtx = ctx.close;
    const { db, runEffect } = ctx;
    await seedUser(db, { id: "alice" });
    for (let index = 1; index <= 12; index += 1) {
      await seedUser(db, {
        id: `mention-${index}`,
        username: `mnum${String(index).padStart(2, "0")}`,
      });
    }
    const content = Array.from(
      { length: 12 },
      (_, index) => `@mnum${String(index + 1).padStart(2, "0")}`,
    ).join(" ");

    const canonical = await runEffect(
      canonicalizeCommentMentions({
        authorId: "alice",
        content,
      }),
    );

    expect(canonical.mentionUserIds).toHaveLength(10);
    expect(canonical.content.endsWith("@mnum11 @mnum12")).toBe(true);
  });

  it("canonicalizes only active users other than the author", async () => {
    const ctx = await makeServiceTestLayer(CommunityActivityServiceLive);
    closeCtx = ctx.close;
    const { db, runEffect } = ctx;
    await seedUser(db, { id: "alice" });
    await seedUser(db, { id: "bob" });
    await seedUser(db, {
      id: "gone",
      deletedAt: new Date("2026-01-01"),
    });

    const canonical = await runEffect(
      canonicalizeCommentMentions({
        authorId: "alice",
        content: "@alice @bob @gone",
      }),
    );

    expect(canonical.mentionUserIds).toEqual(["bob"]);
    expect(canonical.content).toBe("@alice [@bob](user:bob) @gone");
  });
});

describe("CommunityActivityService best-effort", () => {
  it("record never fails when the ledger write fails", async () => {
    const ctx = await makeServiceTestLayer(CommunityActivityServiceLive);
    closeCtx = ctx.close;
    const { db, runEffect } = ctx;
    await seedUser(db, { id: "alice" });
    const postId = await seedPost(db, "alice");
    // Dropping the points column breaks only the ledger insert.
    await sql`ALTER TABLE points_ledger DROP COLUMN points`.execute(db);
    try {
      await expect(
        runEffect(
          record({
            _tag: "PostUploaded",
            authorId: "alice",
            postId,
          }),
        ),
      ).resolves.toBeUndefined();
    } finally {
      await sql`ALTER TABLE points_ledger ADD COLUMN points integer NOT NULL DEFAULT 0`.execute(
        db,
      );
    }
    expect(await ledgerFor(db, "alice")).toEqual([]);
  });

  it("record keeps the award when the inbox insert fails", async () => {
    const ctx = await makeServiceTestLayer(failingInboxLayer);
    closeCtx = ctx.close;
    const { db, runEffect } = ctx;
    await seedUser(db, { id: "owner" });
    await seedUser(db, { id: "suggester" });
    const postId = await seedPost(db, "owner");

    await expect(
      runEffect(
        record({
          _tag: "EditApproved",
          editId: 7,
          postId,
          postOwnerId: "owner",
          suggestedById: "suggester",
        }),
      ),
    ).resolves.toBeUndefined();

    expect(await ledgerFor(db, "suggester")).toHaveLength(1);
    expect(await inboxFor(db, "suggester")).toEqual([]);
  });

  it("record resolves when the inbox insert fails for a committed promotion", async () => {
    const ctx = await makeServiceTestLayer(failingInboxLayer);
    closeCtx = ctx.close;
    const { db, runEffect } = ctx;
    await seedUser(db, { id: "candidate" });

    await expect(
      runEffect(
        record({
          _tag: "PromotionApproved",
          userId: "candidate",
        }),
      ),
    ).resolves.toBeUndefined();
    expect(await inboxFor(db, "candidate")).toEqual([]);
  });
});
