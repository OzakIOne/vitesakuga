import { Effect } from "effect";
import { sql, type Kysely } from "kysely";
import { afterEach, describe, expect, it } from "vitest";

import { makeAuthSession } from "../auth/session.fixture";
import type { DB } from "../db/kysely";
import { makeServiceTestLayer } from "../db/test-utils";
import { asPostId } from "../ids";
import {
  decodePostEditPayload,
  type PostEditPayload,
} from "./post-edits.schema";
import { PostEditsService, PostEditsServiceLive } from "./post-edits.service";

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

const insertPost = async (db: Kysely<DB>, ownerId: string) => {
  postSeq += 1;
  await db
    .insertInto("posts")
    .values({
      description: "original description",
      id: postSeq,
      thumbnailKey: `thumb-${postSeq}.jpg`,
      title: "Original title",
      userId: ownerId,
      videoKey: null,
      videoMetadata: "{}",
    })
    .execute();
  // Services take the branded PostId; brand the seed id so callers stay typed.
  return asPostId(postSeq);
};

const editRow = (db: Kysely<DB>, editId: number) =>
  db
    .selectFrom("post_edits")
    .selectAll()
    .where("id", "=", editId)
    .executeTakeFirstOrThrow();

const PAYLOAD: PostEditPayload = {
  description: "improved description",
  title: "Improved title",
};

describe("PostEditsService.propose", () => {
  it("lets an uploader suggest an edit on someone else's post", async () => {
    const ctx = await makeServiceTestLayer(PostEditsServiceLive);
    closeCtx = ctx.close;
    const { db } = ctx;
    await insertUser(db, { id: "author-1", role: "novice" });
    await insertUser(db, { id: "uploader-1", role: "uploader" });
    const postId = await insertPost(db, "author-1");

    ctx.mockGetSession.mockResolvedValue(
      makeAuthSession({ id: "uploader-1", role: "uploader" }),
    );
    const result = await ctx.runEffect(
      PostEditsService.propose({ payload: PAYLOAD, postId }),
    );

    const row = await editRow(db, result.editId);
    expect(row.status).toBe("pending");
    expect(decodePostEditPayload(row.payload)).toEqual(PAYLOAD);
  });

  it("fails with UnauthorizedError when signed out", async () => {
    const ctx = await makeServiceTestLayer(PostEditsServiceLive);
    closeCtx = ctx.close;
    const { db } = ctx;
    await insertUser(db, { id: "author-1", role: "novice" });
    const postId = await insertPost(db, "author-1");
    ctx.mockGetSession.mockResolvedValue(null);

    const error = await ctx.runEffect(
      Effect.flip(PostEditsService.propose({ payload: PAYLOAD, postId })),
    );
    expect(error._tag).toBe("UnauthorizedError");
    expect(error.message).toBe("You must be logged in to suggest an edit");
  });

  it("fails with PostNotFoundError when the post does not exist", async () => {
    const ctx = await makeServiceTestLayer(PostEditsServiceLive);
    closeCtx = ctx.close;
    const { db } = ctx;
    await insertUser(db, { id: "uploader-1", role: "uploader" });
    ctx.mockGetSession.mockResolvedValue(
      makeAuthSession({ id: "uploader-1", role: "uploader" }),
    );

    const error = await ctx.runEffect(
      Effect.flip(PostEditsService.propose({ payload: PAYLOAD, postId: 9999 })),
    );
    expect(error._tag).toBe("PostNotFoundError");
    if (error._tag !== "PostNotFoundError") {
      throw new Error(`Expected PostNotFoundError, got ${error._tag}`);
    }
    expect(error.postId).toBe(9999);
    expect(error.message).toBe("Post 9999 not found");
  });

  it("denies novices and redirects owners to the direct-edit path", async () => {
    const ctx = await makeServiceTestLayer(PostEditsServiceLive);
    closeCtx = ctx.close;
    const { db } = ctx;
    await insertUser(db, { id: "author-1", role: "novice" });
    await insertUser(db, { id: "plain-novice", role: "novice" });
    const postId = await insertPost(db, "author-1");

    ctx.mockGetSession.mockResolvedValue(
      makeAuthSession({ id: "plain-novice", role: "novice" }),
    );
    const noviceError = await ctx.runEffect(
      Effect.flip(PostEditsService.propose({ payload: PAYLOAD, postId })),
    );
    expect(noviceError._tag).toBe("ForbiddenError");
    expect(noviceError.message).toBe(
      "You need the uploader rank to suggest edits.",
    );

    ctx.mockGetSession.mockResolvedValue(
      makeAuthSession({ id: "author-1", role: "novice" }),
    );
    const ownerError = await ctx.runEffect(
      Effect.flip(PostEditsService.propose({ payload: PAYLOAD, postId })),
    );
    expect(ownerError._tag).toBe("ValidationError");
    expect(ownerError.message).toBe(
      "This is your post — edit it directly instead",
    );
  });
});

describe("PostEditsService.approve", () => {
  it("applies instantly on staff decision, rewards and notifies the owner", async () => {
    const ctx = await makeServiceTestLayer(PostEditsServiceLive);
    closeCtx = ctx.close;
    const { db } = ctx;
    await insertUser(db, { id: "owner-1", role: "novice" });
    await insertUser(db, { id: "uploader-1", role: "uploader" });
    await insertUser(db, { id: "mod-1", role: "moderator" });
    const postId = await insertPost(db, "owner-1");

    ctx.mockGetSession.mockResolvedValueOnce(
      makeAuthSession({ id: "uploader-1", role: "uploader" }),
    );
    const { editId } = await ctx.runEffect(
      PostEditsService.propose({ payload: PAYLOAD, postId }),
    );

    ctx.mockGetSession.mockResolvedValueOnce(
      makeAuthSession({ id: "mod-1", role: "moderator" }),
    );
    const result = await ctx.runEffect(PostEditsService.approve(editId));
    expect(result.applied).toBe(true);

    const post = await db
      .selectFrom("posts")
      .selectAll()
      .where("id", "=", postId)
      .executeTakeFirstOrThrow();
    expect(post.title).toBe("Improved title");
    expect(post.description).toBe("improved description");

    const row = await editRow(db, editId);
    expect(row.status).toBe("approved");
    expect(row.resolvedBy).toBe("mod-1");

    // Suggester got +10 exactly once.
    const ledger = await db
      .selectFrom("points_ledger")
      .selectAll()
      .where("userId", "=", "uploader-1")
      .execute();
    expect(ledger).toHaveLength(1);
    expect(ledger[0]!.points).toBe(10);

    const ownerInbox = await db
      .selectFrom("notifications")
      .selectAll()
      .where("userId", "=", "owner-1")
      .execute();
    expect(ownerInbox.map((n) => n.type)).toContain("edit-suggestion-applied");
  });

  it("needs two distinct uploader votes otherwise — and blocks self-resolution", async () => {
    const ctx = await makeServiceTestLayer(PostEditsServiceLive);
    closeCtx = ctx.close;
    const { db } = ctx;
    await insertUser(db, { id: "owner-2", role: "novice" });
    for (const name of ["peer-a", "peer-b"]) {
      await insertUser(db, { id: name, role: "uploader" });
    }
    const postId = await insertPost(db, "owner-2");

    ctx.mockGetSession.mockResolvedValue(
      makeAuthSession({ id: "peer-a", role: "uploader" }),
    );
    const { editId } = await ctx.runEffect(
      PostEditsService.propose({ payload: PAYLOAD, postId }),
    );

    // First vote alone does not apply.
    ctx.mockGetSession.mockResolvedValue(
      makeAuthSession({ id: "peer-b", role: "uploader" }),
    );
    const firstVote = await ctx.runEffect(PostEditsService.approve(editId));
    expect(firstVote.applied).toBe(false);

    // The suggester cannot vote on their own suggestion.
    ctx.mockGetSession.mockResolvedValue(
      makeAuthSession({ id: "peer-a", role: "uploader" }),
    );
    const selfError = await ctx.runEffect(
      Effect.flip(PostEditsService.approve(editId)),
    );
    expect(selfError._tag).toBe("ForbiddenError");
    expect(selfError.message).toBe(
      "You cannot approve or reject your own edit suggestion — wait for peer review.",
    );

    // Second uploader tips it over.
    ctx.mockGetSession.mockResolvedValue(
      makeAuthSession({ id: "peer-c", role: "uploader" }),
    );
    await insertUser(db, { id: "peer-c", role: "uploader" });
    const secondVote = await ctx.runEffect(PostEditsService.approve(editId));
    expect(secondVote.applied).toBe(true);

    const appliedEdit = await editRow(db, editId);
    expect(appliedEdit.status).toBe("approved");
  });

  it("fails with UnauthorizedError when signed out", async () => {
    const ctx = await makeServiceTestLayer(PostEditsServiceLive);
    closeCtx = ctx.close;
    const { db } = ctx;
    await insertUser(db, { id: "owner-2", role: "novice" });
    await insertUser(db, { id: "uploader-2", role: "uploader" });
    const postId = await insertPost(db, "owner-2");
    ctx.mockGetSession.mockResolvedValue(
      makeAuthSession({ id: "uploader-2", role: "uploader" }),
    );
    const { editId } = await ctx.runEffect(
      PostEditsService.propose({ payload: PAYLOAD, postId }),
    );
    ctx.mockGetSession.mockResolvedValue(null);

    const error = await ctx.runEffect(
      Effect.flip(PostEditsService.approve(editId)),
    );
    expect(error._tag).toBe("UnauthorizedError");
    expect(error.message).toBe(
      "You must be logged in to review edit suggestions",
    );
  });

  it("fails with EditNotFoundError for unknown edits", async () => {
    const ctx = await makeServiceTestLayer(PostEditsServiceLive);
    closeCtx = ctx.close;
    const { db } = ctx;
    await insertUser(db, { id: "mod-x", role: "moderator" });
    ctx.mockGetSession.mockResolvedValue(
      makeAuthSession({ id: "mod-x", role: "moderator" }),
    );

    const error = await ctx.runEffect(
      Effect.flip(PostEditsService.approve(9999)),
    );
    expect(error._tag).toBe("EditNotFoundError");
    if (error._tag !== "EditNotFoundError") {
      throw new Error(`Expected EditNotFoundError, got ${error._tag}`);
    }
    expect(error.editId).toBe(9999);
    expect(error.message).toBe("Edit suggestion 9999 not found");
  });

  it("fails with EditNotFoundError when the suggested post is deleted", async () => {
    const ctx = await makeServiceTestLayer(PostEditsServiceLive);
    closeCtx = ctx.close;
    const { db } = ctx;
    await insertUser(db, { id: "owner-9", role: "novice" });
    await insertUser(db, { id: "uploader-9", role: "uploader" });
    await insertUser(db, { id: "mod-9", role: "moderator" });
    const postId = await insertPost(db, "owner-9");

    ctx.mockGetSession.mockResolvedValue(
      makeAuthSession({ id: "uploader-9", role: "uploader" }),
    );
    const { editId } = await ctx.runEffect(
      PostEditsService.propose({ payload: PAYLOAD, postId }),
    );

    // The post_edits.postId FK cascades, so the suggestion row goes with
    // the post; a later decision must surface EditNotFound, not a patch of
    // a nonexistent post.
    await db.deleteFrom("posts").where("id", "=", postId).execute();

    ctx.mockGetSession.mockResolvedValue(
      makeAuthSession({ id: "mod-9", role: "moderator" }),
    );
    const error = await ctx.runEffect(
      Effect.flip(PostEditsService.approve(editId)),
    );
    expect(error._tag).toBe("EditNotFoundError");
    if (error._tag !== "EditNotFoundError") {
      throw new Error(`Expected EditNotFoundError, got ${error._tag}`);
    }
    expect(error.editId).toBe(editId);
  });

  it("still applies the edit when the reward write fails (best-effort points)", async () => {
    const ctx = await makeServiceTestLayer(PostEditsServiceLive);
    closeCtx = ctx.close;
    const { db } = ctx;
    await insertUser(db, { id: "owner-6", role: "novice" });
    await insertUser(db, { id: "uploader-6", role: "uploader" });
    await insertUser(db, { id: "mod-6", role: "moderator" });
    const postId = await insertPost(db, "owner-6");

    ctx.mockGetSession.mockResolvedValue(
      makeAuthSession({ id: "uploader-6", role: "uploader" }),
    );
    const { editId } = await ctx.runEffect(
      PostEditsService.propose({ payload: PAYLOAD, postId }),
    );

    // Break exactly the ledger insert (dedupe/cap reads select id/count
    // only); awardOrLog must swallow it and the approval must still land.
    await sql`ALTER TABLE points_ledger DROP COLUMN points`.execute(db);
    let applyResult: { applied: boolean };
    try {
      ctx.mockGetSession.mockResolvedValue(
        makeAuthSession({ id: "mod-6", role: "moderator" }),
      );
      applyResult = await ctx.runEffect(PostEditsService.approve(editId));
    } finally {
      await sql`ALTER TABLE points_ledger ADD COLUMN points integer NOT NULL DEFAULT 0`.execute(
        db,
      );
    }

    expect(applyResult.applied).toBe(true);
    const post = await db
      .selectFrom("posts")
      .selectAll()
      .where("id", "=", postId)
      .executeTakeFirstOrThrow();
    expect(post.title).toBe("Improved title");
    const row = await editRow(db, editId);
    expect(row.status).toBe("approved");

    const ledger = await db
      .selectFrom("points_ledger")
      .selectAll()
      .where("userId", "=", "uploader-6")
      .execute();
    expect(ledger).toHaveLength(0);
  });

  it("fails with EditAlreadyResolvedError when voting after an instant decision", async () => {
    const ctx = await makeServiceTestLayer(PostEditsServiceLive);
    closeCtx = ctx.close;
    const { db } = ctx;
    await insertUser(db, { id: "owner-7", role: "novice" });
    await insertUser(db, { id: "uploader-7", role: "uploader" });
    await insertUser(db, { id: "peer-7", role: "uploader" });
    await insertUser(db, { id: "mod-7", role: "moderator" });
    const postId = await insertPost(db, "owner-7");

    ctx.mockGetSession.mockResolvedValue(
      makeAuthSession({ id: "uploader-7", role: "uploader" }),
    );
    const { editId } = await ctx.runEffect(
      PostEditsService.propose({ payload: PAYLOAD, postId }),
    );

    // A peer votes first (recorded, not applied), staff then applies
    // instantly; the peer's view of the queue resolves afterwards and
    // must meet the settled edit, not re-apply it.
    ctx.mockGetSession.mockResolvedValue(
      makeAuthSession({ id: "peer-7", role: "uploader" }),
    );
    const firstVote = await ctx.runEffect(PostEditsService.approve(editId));
    expect(firstVote.applied).toBe(false);

    ctx.mockGetSession.mockResolvedValue(
      makeAuthSession({ id: "mod-7", role: "moderator" }),
    );
    const applied = await ctx.runEffect(PostEditsService.approve(editId));
    expect(applied.applied).toBe(true);

    ctx.mockGetSession.mockResolvedValue(
      makeAuthSession({ id: "peer-7", role: "uploader" }),
    );
    const lateError = await ctx.runEffect(
      Effect.flip(PostEditsService.approve(editId)),
    );
    expect(lateError._tag).toBe("EditAlreadyResolvedError");
    if (lateError._tag !== "EditAlreadyResolvedError") {
      throw new Error(
        `Expected EditAlreadyResolvedError, got ${lateError._tag}`,
      );
    }
    expect(lateError.editId).toBe(editId);
    expect(lateError.message).toBe(
      `Edit suggestion ${editId} was already approved`,
    );
  });

  it("cannot approve twice or resolve a settled suggestion", async () => {
    const ctx = await makeServiceTestLayer(PostEditsServiceLive);
    closeCtx = ctx.close;
    const { db } = ctx;
    await insertUser(db, { id: "owner-3", role: "novice" });
    await insertUser(db, { id: "uploader-3", role: "uploader" });
    await insertUser(db, { id: "admin-3", role: "admin" });
    const postId = await insertPost(db, "owner-3");

    ctx.mockGetSession.mockResolvedValue(
      makeAuthSession({ id: "uploader-3", role: "uploader" }),
    );
    const { editId } = await ctx.runEffect(
      PostEditsService.propose({ payload: PAYLOAD, postId }),
    );
    ctx.mockGetSession.mockResolvedValue(
      makeAuthSession({ id: "admin-3", role: "admin" }),
    );
    await ctx.runEffect(PostEditsService.approve(editId));

    const error = await ctx.runEffect(
      Effect.flip(PostEditsService.reject(editId)),
    );
    expect(error._tag).toBe("EditAlreadyResolvedError");
    if (error._tag !== "EditAlreadyResolvedError") {
      throw new Error(`Expected EditAlreadyResolvedError, got ${error._tag}`);
    }
    expect(error.editId).toBe(editId);
  });
});

describe("PostEditsService.reject", () => {
  it("is limited to staff and the post owner", async () => {
    const ctx = await makeServiceTestLayer(PostEditsServiceLive);
    closeCtx = ctx.close;
    const { db } = ctx;
    await insertUser(db, { id: "owner-4", role: "novice" });
    await insertUser(db, { id: "mod-4", role: "moderator" });
    await insertUser(db, { id: "propose-4", role: "uploader" });
    await insertUser(db, { id: "lone-uploader", role: "uploader" });
    const postId = await insertPost(db, "owner-4");

    ctx.mockGetSession.mockResolvedValue(
      makeAuthSession({ id: "propose-4", role: "uploader" }),
    );
    const { editId } = await ctx.runEffect(
      PostEditsService.propose({ payload: PAYLOAD, postId }),
    );

    // A plain uploader (not the suggester, not staff, not the owner) cannot
    // reject: the guard reaches the staff/owner gate, not the self-vote one.
    ctx.mockGetSession.mockResolvedValue(
      makeAuthSession({ id: "lone-uploader", role: "uploader" }),
    );
    const error = await ctx.runEffect(
      Effect.flip(PostEditsService.reject(editId)),
    );
    expect(error._tag).toBe("ForbiddenError");
    expect(error.message).toBe(
      "Only staff or the post owner can reject a suggestion.",
    );

    // The owner can.
    ctx.mockGetSession.mockResolvedValue(
      makeAuthSession({ id: "owner-4", role: "novice" }),
    );
    const result = await ctx.runEffect(PostEditsService.reject(editId));
    expect(result.rejected).toBe(true);
    const row = await editRow(db, editId);
    expect(row.status).toBe("rejected");

    // Content untouched by a rejection.
    const post = await db
      .selectFrom("posts")
      .select("title")
      .where("id", "=", postId)
      .executeTakeFirstOrThrow();
    expect(post.title).toBe("Original title");
  });
});

describe("PostEditsService.listPendingForPost", () => {
  it("returns pending suggestions with their approvals", async () => {
    const ctx = await makeServiceTestLayer(PostEditsServiceLive);
    closeCtx = ctx.close;
    const { db } = ctx;
    await insertUser(db, { id: "owner-5", role: "novice" });
    await insertUser(db, { id: "voter-5", role: "uploader" });
    const postId = await insertPost(db, "owner-5");

    ctx.mockGetSession.mockResolvedValue(
      makeAuthSession({ id: "voter-5", role: "uploader" }),
    );
    const { editId } = await ctx.runEffect(
      PostEditsService.propose({ payload: PAYLOAD, postId }),
    );
    ctx.mockGetSession.mockResolvedValue(
      makeAuthSession({ id: "second-voter", role: "uploader" }),
    );
    await insertUser(db, { id: "second-voter", role: "uploader" });
    await ctx.runEffect(PostEditsService.approve(editId));

    ctx.mockGetSession.mockResolvedValue(
      makeAuthSession({ id: "third-voter", role: "uploader" }),
    );
    await insertUser(db, { id: "third-voter", role: "uploader" });
    const pending = await ctx.runEffect(
      PostEditsService.listPendingForPost(postId),
    );

    expect(pending).toHaveLength(1);
    expect(pending[0]!.approvals).toEqual(["second-voter"]);
  });
});
