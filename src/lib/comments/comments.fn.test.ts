import { Effect } from "effect";
import { sql, type Kysely } from "kysely";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { makeAuthSession } from "../auth/session.fixture";
import type { DB } from "../db/kysely";
import {
  makeServiceTestLayer,
  type ServiceTestContext,
} from "../db/test-utils";
import type { PostId } from "../ids";
import { asPostId } from "../ids";
import { CommentsService, CommentsServiceLive } from "./comments.service";

let db: Kysely<DB>;
let runEffect: ServiceTestContext["runEffect"];
let mockGetSession: ReturnType<typeof vi.fn>;
let closeCtx: () => Promise<void>;

const testUser = {
  id: "user-1",
  name: "Alice",
  email: "alice@test.com",
  image: null,
  username: "alice",
};

let postId: PostId;

beforeEach(async () => {
  const ctx = await makeServiceTestLayer(CommentsServiceLive);
  db = ctx.db;
  runEffect = ctx.runEffect;
  mockGetSession = ctx.mockGetSession;
  closeCtx = ctx.close;

  await db.insertInto("user").values(testUser).execute();

  const post = await db
    .insertInto("posts")
    .values({
      title: "Test Post",
      description: "Content",
      userId: "user-1",
      videoKey: "videos/abc.mp4",
      thumbnailKey: "thumbnails/abc.jpg",
      videoMetadata: "{}",
    })
    .returning("id")
    .executeTakeFirstOrThrow();

  postId = asPostId(post.id);
});

afterEach(() => closeCtx());

describe("CommentsService.fetch", () => {
  it("returns empty array when no comments", async () => {
    const result = await runEffect(CommentsService.fetch(postId));
    expect(result).toEqual([]);
  });

  it("returns comments with user info", async () => {
    await db
      .insertInto("comments")
      .values({
        content: "Great post!",
        postId,
        userId: "user-1",
      })
      .execute();

    const result = await runEffect(CommentsService.fetch(postId));

    expect(result).toHaveLength(1);
    expect(result[0].content).toBe("Great post!");
    expect(result[0].userName).toBe("Alice");
    expect(result[0].userImage).toBeNull();
    expect(result[0].postId).toBe(postId);
    expect(result[0].userId).toBe("user-1");
  });

  it("returns comments ordered by newest first", async () => {
    await db
      .insertInto("comments")
      .values({
        content: "First",
        postId,
        userId: "user-1",
        createdAt: new Date("2024-01-01"),
      })
      .execute();
    await db
      .insertInto("comments")
      .values({
        content: "Second",
        postId,
        userId: "user-1",
        createdAt: new Date("2024-01-02"),
      })
      .execute();

    const result = await runEffect(CommentsService.fetch(postId));

    expect(result).toHaveLength(2);
    expect(result[0].content).toBe("Second");
    expect(result[1].content).toBe("First");
  });
});

describe("CommentsService.add", () => {
  it("fails with UnauthorizedError when no session", async () => {
    mockGetSession.mockResolvedValueOnce(null);

    // UnauthorizedError messages reach clients verbatim, so the exact copy
    // is part of the contract.
    const error = await runEffect(
      Effect.flip(
        CommentsService.add({
          content: "Nice!",
          postId,
        }),
      ),
    );

    expect(error._tag).toBe("UnauthorizedError");
    expect(error.message).toBe("You must be logged in to comment");
  });

  it("creates a comment as the session user and returns it", async () => {
    mockGetSession.mockResolvedValueOnce(makeAuthSession({ id: "user-1" }));

    const result = await runEffect(
      CommentsService.add({
        content: "Nice!",
        postId,
      }),
    );

    expect(result.content).toBe("Nice!");
    expect(result.postId).toBe(postId);
    expect(result.userId).toBe("user-1");

    const comments = await db
      .selectFrom("comments")
      .selectAll()
      .where("postId", "=", postId)
      .execute();

    expect(comments).toHaveLength(1);
    expect(comments[0].content).toBe("Nice!");
  });

  it("fails with SqlError when the post does not exist", async () => {
    mockGetSession.mockResolvedValueOnce(makeAuthSession({ id: "user-1" }));

    // CommentsService.add never pre-checks the post: the insert hits the
    // comments.post_id FK constraint and the Kysely wrapper maps the
    // failure to SqlError — there is no PostNotFoundError on this path.
    const error = await runEffect(
      Effect.flip(
        CommentsService.add({
          content: "Bad",
          postId: asPostId(999),
        }),
      ),
    );

    expect(error._tag).toBe("SqlError");
  });

  it("resolves @mentions into rows and notifies the mentioned user", async () => {
    await db
      .insertInto("user")
      .values({
        id: "user-2",
        name: "Bob",
        email: "bob@test.com",
        username: "bob",
      })
      .execute();
    mockGetSession.mockResolvedValueOnce(makeAuthSession({ id: "user-1" }));

    const result = await runEffect(
      CommentsService.add({
        content: "Hey @bob, look at this!",
        postId,
      }),
    );

    // Freshly typed handles are canonicalized to id-based tokens on storage.
    expect(result.content).toBe("Hey [@bob](user:user-2), look at this!");

    const mentions = await db
      .selectFrom("comment_mentions")
      .selectAll()
      .where("commentId", "=", result.id)
      .execute();
    expect(mentions).toHaveLength(1);
    expect(mentions[0].userId).toBe("user-2");

    const notifications = await db
      .selectFrom("notifications")
      .selectAll()
      .where("userId", "=", "user-2")
      .execute();
    expect(notifications).toHaveLength(1);
    expect(notifications[0].type).toBe("comment-mention");
    expect(notifications[0].postId).toBe(postId);

    const fetched = await runEffect(CommentsService.fetch(postId));
    expect(fetched[0].mentions).toEqual([
      { userId: "user-2", username: "bob" },
    ]);
  });

  it("does not mention the author themself", async () => {
    mockGetSession.mockResolvedValueOnce(makeAuthSession({ id: "user-1" }));

    await runEffect(
      CommentsService.add({
        content: "Note to @alice myself",
        postId,
      }),
    );

    const mentions = await db
      .selectFrom("comment_mentions")
      .selectAll()
      .execute();
    expect(mentions).toEqual([]);

    const notifications = await db
      .selectFrom("notifications")
      .selectAll()
      .execute();
    expect(notifications).toEqual([]);
  });

  it("leaves unknown handles unmentioned", async () => {
    mockGetSession.mockResolvedValueOnce(makeAuthSession({ id: "user-1" }));

    await runEffect(
      CommentsService.add({
        content: "Pinging @ghost_who_does_not_exist",
        postId,
      }),
    );

    const mentions = await db
      .selectFrom("comment_mentions")
      .selectAll()
      .execute();
    expect(mentions).toEqual([]);
  });
});

describe("CommentsService.delete_", () => {
  let commentId: PostId;

  beforeEach(async () => {
    const result = await db
      .insertInto("comments")
      .values({
        content: "Delete me",
        postId,
        userId: "user-1",
      })
      .returning("id")
      .executeTakeFirstOrThrow();

    commentId = asPostId(result.id);
  });

  it("fails with UnauthorizedError when no session", async () => {
    mockGetSession.mockResolvedValueOnce(null);

    const error = await runEffect(
      Effect.flip(CommentsService.delete_(commentId)),
    );

    expect(error._tag).toBe("UnauthorizedError");
    expect(error.message).toBe("You must be logged in to delete a comment");
  });

  it("fails with ForbiddenError when user does not own the comment", async () => {
    mockGetSession.mockResolvedValueOnce(makeAuthSession({ id: "user-2" }));

    const error = await runEffect(
      Effect.flip(CommentsService.delete_(commentId)),
    );

    expect(error._tag).toBe("ForbiddenError");
    expect(error.message).toBe("You can only delete your own comments");
  });

  it("fails with CommentNotFoundError when comment does not exist", async () => {
    mockGetSession.mockResolvedValueOnce(makeAuthSession({ id: "user-1" }));

    const error = await runEffect(Effect.flip(CommentsService.delete_(9999)));

    expect(error._tag).toBe("CommentNotFoundError");
    if (error._tag !== "CommentNotFoundError") {
      throw new Error(`Expected CommentNotFoundError, got ${error._tag}`);
    }
    expect(error.commentId).toBe(9999);
    expect(error.message).toBe("Comment 9999 not found");
  });

  it("deletes own comment successfully", async () => {
    mockGetSession.mockResolvedValueOnce(makeAuthSession({ id: "user-1" }));

    const result = await runEffect(CommentsService.delete_(commentId));

    expect(result).toEqual({ success: true });

    const comments = await db
      .selectFrom("comments")
      .selectAll()
      .where("id", "=", commentId)
      .execute();

    expect(comments).toHaveLength(0);
  });
});

describe("CommentsService.update", () => {
  let commentId: number;

  beforeEach(async () => {
    mockGetSession.mockResolvedValueOnce(makeAuthSession({ id: "user-1" }));
    const created = await runEffect(
      CommentsService.add({
        content: "Editable comment",
        postId,
      }),
    );
    commentId = created.id;
  });

  it("fails with UnauthorizedError when no session", async () => {
    mockGetSession.mockResolvedValueOnce(null);

    const error = await runEffect(
      Effect.flip(CommentsService.update({ commentId, content: "Hack" })),
    );

    expect(error._tag).toBe("UnauthorizedError");
    expect(error.message).toBe("You must be logged in to edit a comment");
  });

  it("fails with ForbiddenError when the user does not own the comment", async () => {
    mockGetSession.mockResolvedValueOnce(makeAuthSession({ id: "user-2" }));

    const error = await runEffect(
      Effect.flip(CommentsService.update({ commentId, content: "Hack" })),
    );

    expect(error._tag).toBe("ForbiddenError");
    expect(error.message).toBe("You can only edit your own comments");

    // The comment is untouched.
    const rows = await db
      .selectFrom("comments")
      .selectAll()
      .where("id", "=", commentId)
      .execute();
    expect(rows[0]?.content).toBe("Editable comment");
  });

  it("fails with CommentNotFoundError when the comment does not exist", async () => {
    mockGetSession.mockResolvedValueOnce(makeAuthSession({ id: "user-1" }));

    const error = await runEffect(
      Effect.flip(CommentsService.update({ commentId: 9999, content: "X" })),
    );

    expect(error._tag).toBe("CommentNotFoundError");
    if (error._tag !== "CommentNotFoundError") {
      throw new Error(`Expected CommentNotFoundError, got ${error._tag}`);
    }
    expect(error.commentId).toBe(9999);
    expect(error.message).toBe("Comment 9999 not found");
  });
});

describe("CommentsService.mention edge cases", () => {
  it("keeps working when mention persistence fails (best-effort)", async () => {
    await db
      .insertInto("user")
      .values({
        id: "user-2",
        name: "Bob",
        email: "bob@test.com",
        username: "bob",
      })
      .execute();
    mockGetSession.mockResolvedValueOnce(makeAuthSession({ id: "user-1" }));

    // Make the mention-persistence insert fail (relation gone); the comment
    // itself must still be created and returned.
    await sql`ALTER TABLE comment_mentions RENAME TO comment_mentions_broken`.execute(
      db,
    );
    try {
      const created = await runEffect(
        CommentsService.add({ content: "Hey @bob", postId }),
      );

      // The comment survived with its canonical content; only the mention
      // fan-out was dropped.
      const comment = await db
        .selectFrom("comments")
        .selectAll()
        .where("id", "=", created.id)
        .executeTakeFirstOrThrow();
      expect(comment.content).toBe("Hey [@bob](user:user-2)");
    } finally {
      await sql`ALTER TABLE comment_mentions_broken RENAME TO comment_mentions`.execute(
        db,
      );
    }

    const mentions = await db
      .selectFrom("comment_mentions")
      .selectAll()
      .execute();
    expect(mentions).toEqual([]);

    const notifications = await db
      .selectFrom("notifications")
      .selectAll()
      .execute();
    expect(notifications).toEqual([]);
  });

  it("leaves deleted users unmentioned", async () => {
    await db
      .insertInto("user")
      .values({
        id: "user-2",
        name: "Bob",
        email: "bob@test.com",
        username: "bob",
        deletedAt: new Date("2026-01-01"),
      })
      .execute();
    mockGetSession.mockResolvedValueOnce(makeAuthSession({ id: "user-1" }));

    const result = await runEffect(
      CommentsService.add({ content: "Hey @bob", postId }),
    );

    // Deleted accounts are not mention targets: the handle stays plain text.
    expect(result.content).toBe("Hey @bob");

    const mentions = await db
      .selectFrom("comment_mentions")
      .selectAll()
      .execute();
    expect(mentions).toEqual([]);

    const notifications = await db
      .selectFrom("notifications")
      .selectAll()
      .execute();
    expect(notifications).toEqual([]);
  });

  it("keeps rendering mentions of deleted users on fetch", async () => {
    await db
      .insertInto("user")
      .values({
        id: "user-2",
        name: "Bob",
        email: "bob@test.com",
        username: "bob",
      })
      .execute();
    mockGetSession.mockResolvedValueOnce(makeAuthSession({ id: "user-1" }));
    const created = await runEffect(
      CommentsService.add({ content: "Hey @bob", postId }),
    );

    // Bob is anonymized after the fact: the stored mention must still
    // resolve so the old comment renders (the profile shows "Deleted user").
    await db
      .updateTable("user")
      .set({ deletedAt: new Date("2026-01-01") })
      .where("id", "=", "user-2")
      .execute();

    const fetched = await runEffect(CommentsService.fetch(postId));
    const rendered = fetched.find((row) => row.id === created.id);
    expect(rendered?.mentions).toEqual([{ userId: "user-2", username: "bob" }]);
  });

  it("caps mentions at 10 per comment", async () => {
    for (let i = 1; i <= 12; i += 1) {
      await db
        .insertInto("user")
        .values({
          id: `user-mention-${i}`,
          name: `Mention ${i}`,
          email: `mention-${i}@test.com`,
          username: `mnum${String(i).padStart(2, "0")}`,
        })
        .execute();
    }
    const handles = Array.from(
      { length: 12 },
      (_, i) => `@mnum${String(i + 1).padStart(2, "0")}`,
    );
    mockGetSession.mockResolvedValueOnce(makeAuthSession({ id: "user-1" }));

    const result = await runEffect(
      CommentsService.add({ content: `Pinging ${handles.join(" ")}`, postId }),
    );

    // Exactly the first 10 handles are canonicalized; the tail stays text.
    const tokens = result.content.match(/\(user:user-mention-\d+\)/g) ?? [];
    expect(tokens).toHaveLength(10);
    expect(result.content.endsWith("@mnum11 @mnum12")).toBe(true);

    const mentions = await db
      .selectFrom("comment_mentions")
      .selectAll()
      .where("commentId", "=", result.id)
      .execute();
    expect(mentions).toHaveLength(10);

    const notifications = await db
      .selectFrom("notifications")
      .selectAll()
      .where("type", "=", "comment-mention")
      .execute();
    expect(notifications).toHaveLength(10);
  });
});

describe("CommentsService.update mention re-resolution", () => {
  let commentId: number;

  beforeEach(async () => {
    await db
      .insertInto("user")
      .values({
        id: "user-2",
        name: "Bob",
        email: "bob@test.com",
        username: "bob",
      })
      .execute();
    await db
      .insertInto("user")
      .values({
        id: "user-3",
        name: "Carol",
        email: "carol@test.com",
        username: "carol",
      })
      .execute();

    mockGetSession.mockResolvedValueOnce(makeAuthSession({ id: "user-1" }));
    const created = await runEffect(
      CommentsService.add({
        content: "Hey @bob",
        postId,
      }),
    );
    commentId = created.id;
  });

  it("notifies only newly mentioned users when editing", async () => {
    mockGetSession.mockResolvedValueOnce(makeAuthSession({ id: "user-1" }));

    const result = await runEffect(
      CommentsService.update({
        commentId,
        content: "Hey @bob and @carol",
      }),
    );
    expect(result).toEqual({ success: true });

    const notifications = await db
      .selectFrom("notifications")
      .selectAll()
      .where("type", "=", "comment-mention")
      .execute();
    expect(notifications.map((row) => row.userId).sort()).toEqual([
      "user-2",
      "user-3",
    ]);

    const mentions = await db
      .selectFrom("comment_mentions")
      .selectAll()
      .where("commentId", "=", commentId)
      .execute();
    expect(mentions.map((row) => row.userId).sort()).toEqual([
      "user-2",
      "user-3",
    ]);
  });

  it("does not re-notify on unrelated edits", async () => {
    mockGetSession.mockResolvedValueOnce(makeAuthSession({ id: "user-1" }));

    await runEffect(
      CommentsService.update({
        commentId,
        content: "Hey @bob, edited typo",
      }),
    );

    const notifications = await db
      .selectFrom("notifications")
      .selectAll()
      .where("type", "=", "comment-mention")
      .execute();
    expect(notifications).toHaveLength(1);
  });
});
