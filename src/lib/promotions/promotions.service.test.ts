import type { Kysely } from "kysely";
import { describe, expect, it } from "vitest";

import type { DB } from "../db/kysely";
import { makeServiceTestLayer } from "../db/test-utils";
import { PROMOTION_RULES } from "./promotions.config";
import { PromotionsService, PromotionsServiceLive } from "./promotions.service";

const DAY_MS = 86_400_000;

type TestContext = Awaited<ReturnType<typeof makeServiceTestLayer>>;

const insertUser = (
  db: Kysely<DB>,
  args: {
    id: string;
    role?: string;
    createdAtDaysAgo?: number;
  },
) =>
  db
    .insertInto("user")
    .values({
      createdAt: new Date(Date.now() - (args.createdAtDaysAgo ?? 0) * DAY_MS),
      email: `${args.id}@test.com`,
      id: args.id,
      name: args.id,
      role: args.role ?? "novice",
    })
    .execute();

let ledgerRef = 0;

// Seeds a lifetime total by writing the ledger directly: PointsService.award
// enforces the daily caps this suite intentionally blows past.
const earn = async (db: Kysely<DB>, userId: string, points: number) => {
  ledgerRef += 1;
  await db
    .insertInto("points_ledger")
    .values({
      action: "post-upload",
      points,
      refId: ledgerRef,
      userId,
    })
    .execute();
};

describe("PromotionsService.queue", () => {
  it("is staff-only", async () => {
    const ctx: TestContext = await makeServiceTestLayer(PromotionsServiceLive);
    ctx.mockGetSession.mockResolvedValueOnce({
      user: { id: "novice-1", role: "novice" },
    });
    await expect(
      ctx.runEffect(PromotionsService.queue()),
    ).rejects.toMatchObject({ _tag: "ForbiddenError" });
  });

  it("lists eligible novices with their activity", async () => {
    const ctx: TestContext = await makeServiceTestLayer(PromotionsServiceLive);
    const { db } = ctx;
    ctx.mockGetSession.mockResolvedValueOnce({
      user: { id: "mod-1", role: "moderator" },
    });

    await insertUser(db, { createdAtDaysAgo: 10, id: "candidate-1" });
    await insertUser(db, { createdAtDaysAgo: 10, id: "peer-voter" });
    await db
      .insertInto("posts")
      .values({
        content: "c",
        thumbnailKey: "t.jpg",
        title: "P",
        userId: "candidate-1",
        videoMetadata: "{}",
      })
      .execute();
    const post = await db
      .selectFrom("posts")
      .selectAll()
      .where("userId", "=", "candidate-1")
      .executeTakeFirstOrThrow();
    await db
      .insertInto("comments")
      .values({ content: "gg", postId: post.id, userId: "peer-voter" })
      .execute();
    await db
      .insertInto("post_votes")
      .values({ postId: post.id, userId: "peer-voter", vote: "like" })
      .execute();

    await earn(db, "candidate-1", PROMOTION_RULES.minPoints);

    const queue = await ctx.runEffect(PromotionsService.queue());
    expect(queue).toHaveLength(1);
    expect(queue[0].userId).toBe("candidate-1");
    expect(queue[0].activity.uploads).toBeGreaterThanOrEqual(1);
    expect(queue[0].activity.likesReceived).toBe(1);
    expect(queue[0].activity.comments).toBe(1);
  });

  it("excludes candidates below the points or age thresholds", async () => {
    const ctx: TestContext = await makeServiceTestLayer(PromotionsServiceLive);
    const { db } = ctx;
    ctx.mockGetSession.mockResolvedValueOnce({
      user: { id: "mod-1", role: "moderator" },
    });

    // Enough points but brand-new account.
    await insertUser(db, { id: "fresh-whale" });
    await earn(db, "fresh-whale", PROMOTION_RULES.minPoints + 100);

    // Old account but not enough points.
    await insertUser(db, { createdAtDaysAgo: 30, id: "patient-crawler" });
    await earn(db, "patient-crawler", PROMOTION_RULES.minPoints - 200);

    const queue = await ctx.runEffect(PromotionsService.queue());
    expect(queue.map((entry) => entry.userId)).toEqual([]);
  });
});

describe("PromotionsService.approve", () => {
  it("promotes the candidate, records the review and notifies", async () => {
    const ctx: TestContext = await makeServiceTestLayer(PromotionsServiceLive);
    const { db } = ctx;
    await insertUser(db, { createdAtDaysAgo: 9, id: "future-uploader" });
    await earn(db, "future-uploader", PROMOTION_RULES.minPoints);
    ctx.mockGetSession.mockResolvedValue({
      user: { id: "mod-1", role: "moderator" },
    });

    const result = await ctx.runEffect(
      PromotionsService.approve("future-uploader"),
    );
    expect(result.userId).toBe("future-uploader");

    const promoted = await db
      .selectFrom("user")
      .select("role")
      .where("id", "=", "future-uploader")
      .executeTakeFirstOrThrow();
    expect(promoted.role).toBe("uploader");

    const reviews = await db
      .selectFrom("promotion_reviews")
      .selectAll()
      .where("userId", "=", "future-uploader")
      .execute();
    expect(reviews).toHaveLength(1);
    expect(reviews[0].status).toBe("approved");
    expect(reviews[0].reviewedBy).toBe("mod-1");
    expect(reviews[0].pointsAtReview).toBeGreaterThanOrEqual(
      PROMOTION_RULES.minPoints,
    );

    const candidateInbox = await db
      .selectFrom("notifications")
      .selectAll()
      .where("userId", "=", "future-uploader")
      .execute();
    expect(candidateInbox.map((row) => row.type)).toContain(
      "promotion-approved",
    );
  });

  it("refuses a second review of an already-promoted user", async () => {
    const ctx: TestContext = await makeServiceTestLayer(PromotionsServiceLive);
    const { db } = ctx;
    await insertUser(db, { createdAtDaysAgo: 9, id: "once-only" });
    await earn(db, "once-only", PROMOTION_RULES.minPoints);
    ctx.mockGetSession.mockResolvedValue({
      user: { id: "mod-1", role: "moderator" },
    });

    await ctx.runEffect(PromotionsService.approve("once-only"));
    await expect(
      ctx.runEffect(PromotionsService.reject("once-only")),
    ).rejects.toMatchObject({ _tag: "PromotionAlreadyReviewedError" });

    void db;
  });

  it("re-checks eligibility against the live total", async () => {
    const ctx: TestContext = await makeServiceTestLayer(PromotionsServiceLive);
    const { db, runEffect } = ctx;
    // Account old enough but with (almost) no points: a stale queue entry.
    await insertUser(db, { createdAtDaysAgo: 9, id: "stale-entry" });
    ctx.mockGetSession.mockResolvedValue({
      user: { id: "mod-1", role: "moderator" },
    });

    await expect(
      runEffect(PromotionsService.approve("stale-entry")),
    ).rejects.toMatchObject({ _tag: "PromotionNotEligibleError" });
  });
});

describe("PromotionsService.reject", () => {
  it("hides the candidate until they out-earn the rejection snapshot", async () => {
    const ctx: TestContext = await makeServiceTestLayer(PromotionsServiceLive);
    const { db } = ctx;
    await insertUser(db, { createdAtDaysAgo: 9, id: "comeback-kid" });
    await earn(db, "comeback-kid", PROMOTION_RULES.minPoints);
    ctx.mockGetSession.mockResolvedValue({
      user: { id: "mod-1", role: "moderator" },
    });

    await ctx.runEffect(PromotionsService.reject("comeback-kid"));

    const stillHidden = await ctx.runEffect(PromotionsService.queue());
    expect(stillHidden.map((entry) => entry.userId)).not.toContain(
      "comeback-kid",
    );

    // Earn more than the snapshot → back in the queue for a second chance.
    await earn(db, "comeback-kid", 200);
    const visibleAgain = await ctx.runEffect(PromotionsService.queue());
    expect(visibleAgain.map((entry) => entry.userId)).toContain("comeback-kid");

    void db;
  });
});
