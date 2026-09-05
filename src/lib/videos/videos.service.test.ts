import { Effect } from "effect";
import type { Kysely } from "kysely";
import { afterEach, describe, expect, it } from "vitest";

import { makeAuthSession } from "../auth/session.fixture";
import type { DB } from "../db/kysely";
import {
  makeServiceTestLayer,
  type ServiceTestContext,
} from "../db/test-utils";
import { StorageModule } from "../storage/storage.module";
import { REVISION_RETENTION_DAYS, DAY_MS } from "./videos.config";
import { VideosService, VideosServiceLive } from "./videos.service";

let closeCtx: (() => Promise<void>) | undefined;

afterEach(async () => {
  await closeCtx?.();
  closeCtx = undefined;
});

let postSeq = 0;

const insertUser = (db: Kysely<DB>, args: { id: string; role: string }) =>
  db
    .insertInto("user")
    .values({
      email: `${args.id}@test.com`,
      id: args.id,
      name: args.id,
      role: args.role,
      username: args.id.toLowerCase(),
    })
    .execute();

const insertVideoPost = async (
  db: Kysely<DB>,
  ownerId: string,
  videoKey: string,
) => {
  postSeq += 1;
  await db
    .insertInto("posts")
    .values({
      description: "content",
      id: postSeq,
      thumbnailKey: `thumbnails/x.jpg`,
      title: "Post",
      userId: ownerId,
      videoKey,
      videoMetadata: "{}",
    })
    .execute();
  return postSeq;
};

/** Mirrors the real client flow: presign, PUT bytes, return the staged key. */
const stageVideo = async (
  ctx: Pick<ServiceTestContext, "runEffect">,
  userId: string,
  name = "upgrade.mp4",
) => {
  const staged = await ctx.runEffect(
    Effect.gen(function* () {
      const storage = yield* StorageModule;
      return yield* storage.presignVideoUpload(userId, "mp4");
    }),
  );
  const response = await fetch(staged.url, {
    method: "PUT",
    body: new File(["new video bytes"], name, { type: "video/mp4" }),
    headers: { "Content-Type": staged.contentType },
  });
  expect(response.ok).toBe(true);
  return staged.key;
};

describe("VideosService.replace", () => {
  it("swaps the video, archives the old one and keeps likes/comments", async () => {
    const ctx = await makeServiceTestLayer(VideosServiceLive);
    closeCtx = ctx.close;
    const { db, mockGetSession } = ctx;
    await insertUser(db, { id: "author-1", role: "novice" });
    await insertUser(db, { id: "fan-1", role: "novice" });
    const postId = await insertVideoPost(
      db,
      "author-1",
      "videos/author-1/old.mp4",
    );
    await db
      .insertInto("post_votes")
      .values({ postId, userId: "fan-1", vote: "like" })
      .execute();
    await db
      .insertInto("comments")
      .values({ content: "<3", postId, userId: "fan-1" })
      .execute();

    // Seed the live object so the swap has something real to archive.
    await db
      .selectFrom("posts")
      .selectAll()
      .where("id", "=", postId)
      .executeTakeFirstOrThrow();
    mockGetSession.mockResolvedValue(
      makeAuthSession({ id: "author-1", role: "novice" }),
    );
    const pendingVideoKey = await stageVideo(ctx, "author-1");

    const result = await ctx.runEffect(
      VideosService.replace({ pendingVideoKey, postId }),
    );

    // Post row keeps its id/likes/comments; only the key changed.
    const post = await db
      .selectFrom("posts")
      .selectAll()
      .where("id", "=", postId)
      .executeTakeFirstOrThrow();
    expect(post.videoKey).toBe(result.videoKey);

    const revision = await db
      .selectFrom("video_revisions")
      .selectAll()
      .where("postId", "=", postId)
      .executeTakeFirstOrThrow();
    expect(revision.videoKey).toBe("videos/author-1/old.mp4");
    expect(revision.replacedBy).toBe("author-1");

    const votes = await db
      .selectFrom("post_votes")
      .selectAll()
      .where("postId", "=", postId)
      .execute();
    expect(votes).toHaveLength(1);
    const comments = await db
      .selectFrom("comments")
      .selectAll()
      .where("postId", "=", postId)
      .execute();
    expect(comments).toHaveLength(1);
  });

  it("rejects staged keys outside the caller's own namespace and non-authors", async () => {
    const ctx = await makeServiceTestLayer(VideosServiceLive);
    closeCtx = ctx.close;
    const { db, mockGetSession } = ctx;
    await insertUser(db, { id: "author-2", role: "novice" });
    await insertUser(db, { id: "intruder-2", role: "novice" });
    const postId = await insertVideoPost(
      db,
      "author-2",
      "videos/author-2/x.mp4",
    );

    // A foreign staging key is refused even for the author.
    mockGetSession.mockResolvedValue(
      makeAuthSession({ id: "author-2", role: "novice" }),
    );
    const foreignKeyError = await ctx.runEffect(
      Effect.flip(
        VideosService.replace({
          pendingVideoKey: "videos/_pending/someone-else/evil.mp4",
          postId,
        }),
      ),
    );
    expect(foreignKeyError._tag).toBe("ValidationError");

    // A plain novice cannot replace someone else's video.
    mockGetSession.mockResolvedValue(
      makeAuthSession({ id: "intruder-2", role: "novice" }),
    );
    const intruderError = await ctx.runEffect(
      Effect.flip(
        VideosService.replace({
          pendingVideoKey: "videos/_pending/intruder-2/nope.mp4",
          postId,
        }),
      ),
    );
    expect(intruderError._tag).toBe("ForbiddenError");
  });

  it("lets a moderator replace any user's video", async () => {
    const ctx = await makeServiceTestLayer(VideosServiceLive);
    closeCtx = ctx.close;
    const { db, mockGetSession } = ctx;
    await insertUser(db, { id: "author-3", role: "novice" });
    await insertUser(db, { id: "mod-3", role: "moderator" });
    const postId = await insertVideoPost(
      db,
      "author-3",
      "videos/author-3/a.mp4",
    );

    mockGetSession.mockResolvedValue(
      makeAuthSession({ id: "mod-3", role: "moderator" }),
    );
    const pendingVideoKey = await stageVideo(ctx, "mod-3");

    const result = await ctx.runEffect(
      VideosService.replace({ pendingVideoKey, postId }),
    );
    expect(result.videoKey).toMatch(/^videos\/mod-3\//);
  });
});

describe("VideosService.listRevisions", () => {
  it("is owner/staff-only and lists newest first", async () => {
    const ctx = await makeServiceTestLayer(VideosServiceLive);
    closeCtx = ctx.close;
    const { db, mockGetSession } = ctx;
    await insertUser(db, { id: "author-4", role: "novice" });
    await insertUser(db, { id: "mod-4", role: "moderator" });
    await insertUser(db, { id: "stranger-4", role: "novice" });
    const postId = await insertVideoPost(
      db,
      "author-4",
      "videos/author-4/v.mp4",
    );

    mockGetSession.mockResolvedValue(
      makeAuthSession({ id: "mod-4", role: "moderator" }),
    );
    const pendingVideoKeyA = await stageVideo(ctx, "mod-4", "a.mp4");
    await ctx.runEffect(
      VideosService.replace({ pendingVideoKey: pendingVideoKeyA, postId }),
    );
    const pendingVideoKeyB = await stageVideo(ctx, "mod-4", "b.mp4");
    await ctx.runEffect(
      VideosService.replace({ pendingVideoKey: pendingVideoKeyB, postId }),
    );

    mockGetSession.mockResolvedValue(
      makeAuthSession({ id: "stranger-4", role: "novice" }),
    );
    const listError = await ctx.runEffect(
      Effect.flip(VideosService.listRevisions(postId)),
    );
    expect(listError._tag).toBe("ForbiddenError");

    mockGetSession.mockResolvedValue(
      makeAuthSession({ id: "author-4", role: "novice" }),
    );
    const revisions = await ctx.runEffect(VideosService.listRevisions(postId));
    expect(revisions).toHaveLength(2);
    // Newest first: the second replacement archived the first staged video,
    // the oldest entry holds the post's original object.
    expect(revisions[0]!.videoKey).toMatch(/^videos\/mod-4\//);
    expect(revisions[1]!.videoKey).toBe("videos/author-4/v.mp4");
    expect(
      new Date(revisions[0]!.createdAt) >= new Date(revisions[1]!.createdAt),
    ).toBe(true);
  });
});

describe("VideosService.restore", () => {
  it("is staff-only and swaps back while archiving the current video", async () => {
    const ctx = await makeServiceTestLayer(VideosServiceLive);
    closeCtx = ctx.close;
    const { db, mockGetSession } = ctx;
    await insertUser(db, { id: "author-5", role: "novice" });
    await insertUser(db, { id: "mod-5", role: "moderator" });
    const postId = await insertVideoPost(
      db,
      "author-5",
      "videos/author-5/orig.mp4",
    );

    mockGetSession.mockResolvedValue(
      makeAuthSession({ id: "mod-5", role: "moderator" }),
    );
    const pendingVideoKey = await stageVideo(ctx, "mod-5");
    await ctx.runEffect(VideosService.replace({ pendingVideoKey, postId }));

    // Author cannot restore (novice).
    mockGetSession.mockResolvedValue(
      makeAuthSession({ id: "author-5", role: "novice" }),
    );
    const restoreError = await ctx.runEffect(
      Effect.flip(VideosService.restore(1)),
    );
    expect(restoreError._tag).toBe("ForbiddenError");

    // Moderator restores the original.
    mockGetSession.mockResolvedValue(
      makeAuthSession({ id: "mod-5", role: "moderator" }),
    );
    const result = await ctx.runEffect(VideosService.restore(1));
    expect(result.restored).toBe(true);

    const post = await db
      .selectFrom("posts")
      .select("videoKey")
      .where("id", "=", postId)
      .executeTakeFirstOrThrow();
    expect(post.videoKey).toBe("videos/author-5/orig.mp4");

    // The upgraded video got archived in turn → still 2 revisions.
    const revisions = await db
      .selectFrom("video_revisions")
      .selectAll()
      .where("postId", "=", postId)
      .execute();
    expect(revisions.length).toBeGreaterThanOrEqual(2);
  });
});

describe("VideosService.gc", () => {
  const seedRevision = async (
    db: Kysely<DB>,
    args: {
      ageDays: number;
      postId: number;
      replacedBy: string;
      videoKey: string;
    },
  ) => {
    await db
      .insertInto("video_revisions")
      .values({
        createdAt: new Date(Date.now() - args.ageDays * DAY_MS),
        postId: args.postId,
        replacedBy: args.replacedBy,
        videoKey: args.videoKey,
        videoMetadata: "{}",
      })
      .execute();
  };

  it("preview is admin-only and flags expired revisions + orphans", async () => {
    // Orphan analysis lists the whole `videos/` namespace; parallel workers
    // share the bucket, so the listing is scoped to keys this test created.
    const ownedKeys: string[] = [];
    const ctx = await makeServiceTestLayer(VideosServiceLive, {
      wrapStorage: (storage) => ({
        ...storage,
        listKeys: (prefix) =>
          prefix === "videos/"
            ? Effect.succeed([...ownedKeys])
            : storage.listKeys(prefix),
      }),
    });
    closeCtx = ctx.close;
    const { db, mockGetSession } = ctx;
    await insertUser(db, { id: "admin-6", role: "admin" });
    await insertUser(db, { id: "mod-6", role: "moderator" });
    await insertUser(db, { id: "author-6", role: "novice" });

    // A real unreferenced object in this test's listing scope: the preview
    // must flag exactly it as an orphan (a live bucket object, not a vacuous
    // shape check).
    const orphanKey = await ctx.runEffect(
      Effect.gen(function* () {
        const storage = yield* StorageModule;
        const { key } = yield* storage.uploadVideo(
          "gc-preview-orphan",
          new File(["orphan"], "orphan.mp4", { type: "video/mp4" }),
        );
        return key;
      }),
    );
    ownedKeys.push(orphanKey);

    // Expired & clean → purgeable.
    const cleanId = await insertVideoPost(db, "author-6", "videos/a/clean.mp4");
    await seedRevision(db, {
      ageDays: REVISION_RETENTION_DAYS + 1,
      postId: cleanId,
      replacedBy: "author-6",
      videoKey: "videos/old/clean-old.mp4",
    });
    // Expired but recently reported → kept.
    const reportedId = await insertVideoPost(
      db,
      "author-6",
      "videos/b/reported.mp4",
    );
    await seedRevision(db, {
      ageDays: REVISION_RETENTION_DAYS + 5,
      postId: reportedId,
      replacedBy: "author-6",
      videoKey: "videos/old/reported-old.mp4",
    });
    await db
      .insertInto("post_reports")
      .values({
        createdAt: new Date(Date.now() - DAY_MS),
        postId: reportedId,
        reason: "duplicate",
        userId: "admin-6",
      })
      .execute();
    // Young revision → kept.
    const freshId = await insertVideoPost(db, "author-6", "videos/c/fresh.mp4");
    await seedRevision(db, {
      ageDays: 1,
      postId: freshId,
      replacedBy: "author-6",
      videoKey: "videos/old/fresh-old.mp4",
    });

    // Moderator denied.
    mockGetSession.mockResolvedValue(
      makeAuthSession({ id: "mod-6", role: "moderator" }),
    );
    const previewError = await ctx.runEffect(
      Effect.flip(VideosService.gcPreview()),
    );
    expect(previewError._tag).toBe("ForbiddenError");

    mockGetSession.mockResolvedValue(
      makeAuthSession({ id: "admin-6", role: "admin" }),
    );
    const preview = await ctx.runEffect(VideosService.gcPreview());

    const purgeableIds = preview.purgeableRevisions.map((r) => r.id);
    const allRevisions = await db
      .selectFrom("video_revisions")
      .selectAll()
      .execute();
    expect(
      allRevisions.find((r) => purgeableIds.includes(r.id))?.videoKey,
    ).toBe("videos/old/clean-old.mp4");

    // Exactly one live object exists in scope and nothing references it.
    expect(preview.orphanKeys).toEqual([orphanKey]);
  });

  it("run purges expired rows without reports and keeps reported ones", async () => {
    // Orphan analysis lists the whole `videos/` namespace; parallel workers
    // share the bucket, so the listing is scoped to keys this test created —
    // otherwise gcRun would observe (and delete) other workers' objects.
    const ownedKeys: string[] = [];
    const ctx = await makeServiceTestLayer(VideosServiceLive, {
      wrapStorage: (storage) => ({
        ...storage,
        listKeys: (prefix) =>
          prefix === "videos/"
            ? Effect.succeed([...ownedKeys])
            : storage.listKeys(prefix),
      }),
    });
    closeCtx = ctx.close;
    const { db, mockGetSession } = ctx;
    await insertUser(db, { id: "admin-7", role: "admin" });
    await insertUser(db, { id: "author-7", role: "novice" });

    const cleanId = await insertVideoPost(db, "author-7", "videos/x/clean.mp4");

    // Seed the purge target as a REAL object: stage, PUT and finalize an
    // upload, then archive that final key as an expired revision. A purge
    // must delete bytes that actually exist (S3 deletes of missing keys
    // always "succeed", so a nonexistent key proves nothing).
    const presigned = await ctx.runEffect(
      Effect.gen(function* () {
        const storage = yield* StorageModule;
        return yield* storage.presignVideoUpload("purge-target", "mp4");
      }),
    );
    const put = await fetch(presigned.url, {
      body: new File(["purge target bytes"], "purge.mp4", {
        type: "video/mp4",
      }),
      headers: { "Content-Type": presigned.contentType },
      method: "PUT",
    });
    expect(put.ok).toBe(true);
    const purgeTargetKey = await ctx.runEffect(
      Effect.gen(function* () {
        const storage = yield* StorageModule;
        const { key } = yield* storage.finalizeVideoUpload(presigned.key);
        return key;
      }),
    );
    ownedKeys.push(purgeTargetKey);
    await seedRevision(db, {
      ageDays: REVISION_RETENTION_DAYS + 2,
      postId: cleanId,
      replacedBy: "author-7",
      videoKey: purgeTargetKey,
    });
    const reportedId = await insertVideoPost(db, "author-7", "videos/x/r.mp4");
    await seedRevision(db, {
      ageDays: REVISION_RETENTION_DAYS + 2,
      postId: reportedId,
      replacedBy: "author-7",
      videoKey: "videos/kept/reported.mp4",
    });
    await db
      .insertInto("post_reports")
      .values({
        createdAt: new Date(Date.now() - DAY_MS),
        postId: reportedId,
        reason: "poor_quality",
        userId: "admin-7",
      })
      .execute();

    // A real unreferenced object inside this test's listing scope: gcRun must
    // delete it as an orphan.
    const orphanKey = await ctx.runEffect(
      Effect.gen(function* () {
        const storage = yield* StorageModule;
        const { key } = yield* storage.uploadVideo(
          "gc-orphan",
          new File(["orphan"], "orphan.mp4", { type: "video/mp4" }),
        );
        return key;
      }),
    );
    ownedKeys.push(orphanKey);

    mockGetSession.mockResolvedValue(
      makeAuthSession({ id: "admin-7", role: "admin" }),
    );
    const result = await ctx.runEffect(VideosService.gcRun());

    // Exactly one seeded revision was purgeable (clean, expired, unreported)
    // and one real orphan object was in scope; nothing else is.
    expect(result.purgedRevisions).toBe(1);
    expect(result.deletedKeys).toBe(2);

    // Both deleted keys were real objects and are really gone from RustFS.
    for (const key of [purgeTargetKey, orphanKey]) {
      const head = await ctx.runEffect(
        Effect.flip(
          Effect.gen(function* () {
            const storage = yield* StorageModule;
            return yield* storage.headFile(key);
          }),
        ),
      );
      expect(head._tag).toBe("StorageError");
      expect(head.operation).toBe("head");
    }

    const remaining = await db
      .selectFrom("video_revisions")
      .selectAll()
      .execute();
    expect(remaining.map((r) => r.videoKey)).toEqual([
      "videos/kept/reported.mp4",
    ]);
  });
});
