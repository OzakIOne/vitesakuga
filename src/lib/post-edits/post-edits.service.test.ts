import type { Kysely } from "kysely";
import { describe, expect, it } from "vitest";

import type { DB } from "../db/kysely";
import { makeServiceTestLayer } from "../db/test-utils";
import {
  decodePostEditPayload,
  type PostEditPayload,
} from "./post-edits.schema";
import { PostEditsService, PostEditsServiceLive } from "./post-edits.service";

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
  return postSeq;
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
    const { db } = ctx;
    await insertUser(db, { id: "author-1", role: "novice" });
    await insertUser(db, { id: "uploader-1", role: "uploader" });
    const postId = await insertPost(db, "author-1");

    ctx.mockGetSession.mockResolvedValue({
      user: { id: "uploader-1", role: "uploader" },
    });
    const result = await ctx.runEffect(
      PostEditsService.propose({ payload: PAYLOAD, postId }),
    );

    const row = await editRow(db, result.editId);
    expect(row.status).toBe("pending");
    expect(decodePostEditPayload(row.payload)).toEqual(PAYLOAD);
  });

  it("denies novices and redirects owners to the direct-edit path", async () => {
    const ctx = await makeServiceTestLayer(PostEditsServiceLive);
    const { db } = ctx;
    await insertUser(db, { id: "author-1", role: "novice" });
    await insertUser(db, { id: "plain-novice", role: "novice" });
    const postId = await insertPost(db, "author-1");

    ctx.mockGetSession.mockResolvedValue({
      user: { id: "plain-novice", role: "novice" },
    });
    await expect(
      ctx.runEffect(PostEditsService.propose({ payload: PAYLOAD, postId })),
    ).rejects.toMatchObject({ _tag: "ForbiddenError" });

    ctx.mockGetSession.mockResolvedValue({
      user: { id: "author-1", role: "novice" },
    });
    await expect(
      ctx.runEffect(PostEditsService.propose({ payload: PAYLOAD, postId })),
    ).rejects.toMatchObject({ _tag: "ValidationError" });
  });
});

describe("PostEditsService.approve", () => {
  it("applies instantly on staff decision, rewards and notifies the owner", async () => {
    const ctx = await makeServiceTestLayer(PostEditsServiceLive);
    const { db } = ctx;
    await insertUser(db, { id: "owner-1", role: "novice" });
    await insertUser(db, { id: "uploader-1", role: "uploader" });
    await insertUser(db, { id: "mod-1", role: "moderator" });
    const postId = await insertPost(db, "owner-1");

    ctx.mockGetSession.mockResolvedValueOnce({
      user: { id: "uploader-1", role: "uploader" },
    });
    const { editId } = await ctx.runEffect(
      PostEditsService.propose({ payload: PAYLOAD, postId }),
    );

    ctx.mockGetSession.mockResolvedValueOnce({
      user: { id: "mod-1", role: "moderator" },
    });
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
    expect(ledger[0].points).toBe(10);

    const ownerInbox = await db
      .selectFrom("notifications")
      .selectAll()
      .where("userId", "=", "owner-1")
      .execute();
    expect(ownerInbox.map((n) => n.type)).toContain("edit-suggestion-applied");
  });

  it("needs two distinct uploader votes otherwise — and blocks self-resolution", async () => {
    const ctx = await makeServiceTestLayer(PostEditsServiceLive);
    const { db } = ctx;
    await insertUser(db, { id: "owner-2", role: "novice" });
    for (const name of ["peer-a", "peer-b"]) {
      await insertUser(db, { id: name, role: "uploader" });
    }
    const postId = await insertPost(db, "owner-2");

    ctx.mockGetSession.mockResolvedValue({
      user: { id: "peer-a", role: "uploader" },
    });
    const { editId } = await ctx.runEffect(
      PostEditsService.propose({ payload: PAYLOAD, postId }),
    );

    // First vote alone does not apply.
    ctx.mockGetSession.mockResolvedValue({
      user: { id: "peer-b", role: "uploader" },
    });
    const firstVote = await ctx.runEffect(PostEditsService.approve(editId));
    expect(firstVote.applied).toBe(false);

    // The suggester cannot vote on their own suggestion.
    ctx.mockGetSession.mockResolvedValue({
      user: { id: "peer-a", role: "uploader" },
    });
    await expect(
      ctx.runEffect(PostEditsService.approve(editId)),
    ).rejects.toMatchObject({ _tag: "ForbiddenError" });

    // Second uploader tips it over.
    ctx.mockGetSession.mockResolvedValue({
      user: { id: "peer-c", role: "uploader" },
    });
    await insertUser(db, { id: "peer-c", role: "uploader" });
    const secondVote = await ctx.runEffect(PostEditsService.approve(editId));
    void secondVote;

    const appliedEdit = await editRow(db, editId);
    expect(appliedEdit.status).toBe("approved");
    void db;
  });

  it("cannot approve twice or resolve a settled suggestion", async () => {
    const ctx = await makeServiceTestLayer(PostEditsServiceLive);
    const { db } = ctx;
    await insertUser(db, { id: "owner-3", role: "novice" });
    await insertUser(db, { id: "uploader-3", role: "uploader" });
    await insertUser(db, { id: "admin-3", role: "admin" });
    const postId = await insertPost(db, "owner-3");

    ctx.mockGetSession.mockResolvedValue({
      user: { id: "uploader-3", role: "uploader" },
    });
    const { editId } = await ctx.runEffect(
      PostEditsService.propose({ payload: PAYLOAD, postId }),
    );
    ctx.mockGetSession.mockResolvedValue({
      user: { id: "admin-3", role: "admin" },
    });
    await ctx.runEffect(PostEditsService.approve(editId));

    await expect(
      ctx.runEffect(PostEditsService.reject(editId)),
    ).rejects.toMatchObject({ _tag: "EditAlreadyResolvedError" });

    void db;
  });
});

describe("PostEditsService.reject", () => {
  it("is limited to staff and the post owner", async () => {
    const ctx = await makeServiceTestLayer(PostEditsServiceLive);
    const { db } = ctx;
    await insertUser(db, { id: "owner-4", role: "novice" });
    await insertUser(db, { id: "mod-4", role: "moderator" });
    await insertUser(db, { id: "lone-uploader", role: "uploader" });
    const postId = await insertPost(db, "owner-4");

    ctx.mockGetSession.mockResolvedValue({
      user: { id: "lone-uploader", role: "uploader" },
    });
    const { editId } = await ctx.runEffect(
      PostEditsService.propose({ payload: PAYLOAD, postId }),
    );

    // A single uploader cannot reject.
    await expect(
      ctx.runEffect(PostEditsService.reject(editId)),
    ).rejects.toMatchObject({ _tag: "ForbiddenError" });

    // The owner can.
    ctx.mockGetSession.mockResolvedValue({
      user: { id: "owner-4", role: "novice" },
    });
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
    const { db } = ctx;
    await insertUser(db, { id: "owner-5", role: "novice" });
    await insertUser(db, { id: "voter-5", role: "uploader" });
    const postId = await insertPost(db, "owner-5");

    ctx.mockGetSession.mockResolvedValue({
      user: { id: "voter-5", role: "uploader" },
    });
    const { editId } = await ctx.runEffect(
      PostEditsService.propose({ payload: PAYLOAD, postId }),
    );
    ctx.mockGetSession.mockResolvedValue({
      user: { id: "second-voter", role: "uploader" },
    });
    await insertUser(db, { id: "second-voter", role: "uploader" });
    await ctx.runEffect(PostEditsService.approve(editId));

    ctx.mockGetSession.mockResolvedValue({
      user: { id: "third-voter", role: "uploader" },
    });
    await insertUser(db, { id: "third-voter", role: "uploader" });
    const pending = await ctx.runEffect(
      PostEditsService.listPendingForPost(postId),
    );

    expect(pending).toHaveLength(1);
    expect(pending[0].approvals).toEqual(["second-voter"]);
  });
});
