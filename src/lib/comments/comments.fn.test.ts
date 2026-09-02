import type { Kysely } from "kysely";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { DB } from "../db/kysely";
import { makeServiceTestLayer } from "../db/test-utils";
import type { PostId } from "../ids";
import { asPostId } from "../ids";
import { CommentsService, CommentsServiceLive } from "./comments.service";

let db: Kysely<DB>;
let runEffect: ReturnType<typeof makeServiceTestLayer>["runEffect"];
let mockGetSession: ReturnType<typeof vi.fn>;

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
  it("throws unauthorized when no session", async () => {
    mockGetSession.mockResolvedValueOnce(null);

    await expect(
      runEffect(
        CommentsService.add({
          content: "Nice!",
          postId,
        }),
      ),
    ).rejects.toThrow("You must be logged in");
  });

  it("creates a comment as the session user and returns it", async () => {
    mockGetSession.mockResolvedValueOnce({ user: { id: "user-1" } });

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

  it("throws on database error for missing post", async () => {
    mockGetSession.mockResolvedValueOnce({ user: { id: "user-1" } });

    await expect(
      runEffect(
        CommentsService.add({
          content: "Bad",
          postId: asPostId(999),
        }),
      ),
    ).rejects.toThrow("SqlError");
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
    mockGetSession.mockResolvedValueOnce({ user: { id: "user-1" } });

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
    mockGetSession.mockResolvedValueOnce({ user: { id: "user-1" } });

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
    mockGetSession.mockResolvedValueOnce({ user: { id: "user-1" } });

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

  it("throws unauthorized when no session", async () => {
    mockGetSession.mockResolvedValueOnce(null);

    await expect(runEffect(CommentsService.delete_(commentId))).rejects.toThrow(
      "You must be logged in",
    );
  });

  it("throws forbidden when user does not own the comment", async () => {
    mockGetSession.mockResolvedValueOnce({ user: { id: "user-2" } });

    await expect(runEffect(CommentsService.delete_(commentId))).rejects.toThrow(
      "can only delete your own",
    );
  });

  it("throws not found when comment does not exist", async () => {
    mockGetSession.mockResolvedValueOnce({ user: { id: "user-1" } });

    await expect(runEffect(CommentsService.delete_(9999))).rejects.toThrow(
      "Comment 9999 not found",
    );
  });

  it("deletes own comment successfully", async () => {
    mockGetSession.mockResolvedValueOnce({ user: { id: "user-1" } });

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

    mockGetSession.mockResolvedValueOnce({ user: { id: "user-1" } });
    const created = await runEffect(
      CommentsService.add({
        content: "Hey @bob",
        postId,
      }),
    );
    commentId = created.id;
  });

  it("notifies only newly mentioned users when editing", async () => {
    mockGetSession.mockResolvedValueOnce({ user: { id: "user-1" } });

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
    mockGetSession.mockResolvedValueOnce({ user: { id: "user-1" } });

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
