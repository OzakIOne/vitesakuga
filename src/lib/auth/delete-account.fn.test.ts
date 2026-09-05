import { Effect } from "effect";
import type { Kysely } from "kysely";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { DB } from "../db/kysely";
import {
  makeServiceTestLayer,
  type ServiceTestContext,
} from "../db/test-utils";
import {
  DeleteAccountService,
  DeleteAccountServiceLive,
} from "./delete-account";
import { makeAuthSession } from "./session.fixture";

let db: Kysely<DB>;
let runEffect: ServiceTestContext["runEffect"];
let mockGetSession: ReturnType<typeof vi.fn>;
let closeCtx: () => Promise<void>;

const testUser = {
  id: "user-1",
  name: "Alice",
  email: "alice@test.com",
  image: "https://example.com/alice.jpg",
  username: "alice",
};

let postId: number;

beforeEach(async () => {
  const ctx = await makeServiceTestLayer(DeleteAccountServiceLive);
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

  postId = post.id;
});

afterEach(() => closeCtx());

describe("DeleteAccountService.deleteAccount", () => {
  it("throws unauthorized when not logged in", async () => {
    mockGetSession.mockResolvedValueOnce(null);

    const error = await runEffect(
      Effect.flip(DeleteAccountService.deleteAccount({})),
    );
    expect(error._tag).toBe("UnauthorizedError");
    expect(error.message).toBe("You must be logged in");
  });

  it("anonymizes the user but keeps posts, comments and votes", async () => {
    mockGetSession.mockResolvedValueOnce(makeAuthSession({ id: "user-1" }));

    await db
      .insertInto("comments")
      .values({ content: "Nice!", postId, userId: "user-1" })
      .execute();
    await db
      .insertInto("post_votes")
      .values({ postId, userId: "user-1", vote: "like" })
      .execute();

    const result = await runEffect(DeleteAccountService.deleteAccount({}));

    expect(result.deletedUserId).toBe("user-1");

    const user = await db
      .selectFrom("user")
      .selectAll()
      .where("id", "=", "user-1")
      .executeTakeFirstOrThrow();
    expect(user.name).toBe("Deleted user");
    expect(user.email).toBe("deleted-user-1@deleted.local");
    expect(user.image).toBeNull();
    expect(user.emailVerified).toBe(false);
    expect(user.twoFactorEnabled).toBe(false);
    expect(user.deletedAt).not.toBeNull();

    const posts = await db.selectFrom("posts").selectAll().execute();
    expect(posts).toHaveLength(1);
    const comments = await db.selectFrom("comments").selectAll().execute();
    expect(comments).toHaveLength(1);
    expect(comments[0].userId).toBe("user-1");
    const votes = await db.selectFrom("post_votes").selectAll().execute();
    expect(votes).toHaveLength(1);
  });

  it("deletes sessions, accounts, passkeys, two-factor and playlists", async () => {
    mockGetSession.mockResolvedValueOnce(makeAuthSession({ id: "user-1" }));

    await db
      .insertInto("session")
      .values({
        id: "session-1",
        token: "token-1",
        userId: "user-1",
        expiresAt: new Date(Date.now() + 60_000),
        createdAt: new Date(),
        updatedAt: new Date(),
      })
      .execute();
    await db
      .insertInto("account")
      .values({
        id: "account-1",
        accountId: "github-1",
        providerId: "github",
        userId: "user-1",
        createdAt: new Date(),
        updatedAt: new Date(),
      })
      .execute();
    await db
      .insertInto("passkey")
      .values({
        id: "passkey-1",
        credentialID: "cred-1",
        publicKey: "pk",
        counter: 0,
        backedUp: false,
        deviceType: "singleDevice",
        userId: "user-1",
      })
      .execute();
    await db
      .insertInto("twoFactor")
      .values({ id: "2fa-1", secret: "s", backupCodes: "b", userId: "user-1" })
      .execute();
    const playlist = await db
      .insertInto("playlists")
      .values({ title: "Favorites", user_id: "user-1" })
      .returning("id")
      .executeTakeFirstOrThrow();
    await db
      .insertInto("playlist_posts")
      .values({ playlist_id: playlist.id, post_id: postId })
      .execute();

    await runEffect(DeleteAccountService.deleteAccount({}));

    expect(await db.selectFrom("session").execute()).toHaveLength(0);
    expect(await db.selectFrom("account").execute()).toHaveLength(0);
    expect(await db.selectFrom("passkey").execute()).toHaveLength(0);
    expect(await db.selectFrom("twoFactor").execute()).toHaveLength(0);
    expect(await db.selectFrom("playlists").execute()).toHaveLength(0);
    expect(await db.selectFrom("playlist_posts").execute()).toHaveLength(0);
  });

  it("requires and verifies the password for credential accounts", async () => {
    // Every invocation below runs against an authenticated session.
    mockGetSession.mockResolvedValue(makeAuthSession({ id: "user-1" }));

    // Insert a credential account with a real Better Auth scrypt hash of
    // "correct-horse" so verifyPassword exercises the actual algorithm.
    const { hashPassword } = await import("better-auth/crypto");
    const hash = await hashPassword("correct-horse");
    await db
      .insertInto("account")
      .values({
        id: "account-cred",
        accountId: "user-1",
        providerId: "credential",
        password: hash,
        userId: "user-1",
        createdAt: new Date(),
        updatedAt: new Date(),
      })
      .execute();

    const noPasswordError = await runEffect(
      Effect.flip(DeleteAccountService.deleteAccount({})),
    );
    expect(noPasswordError._tag).toBe("ForbiddenError");
    expect(noPasswordError.message).toBe(
      "Your password is required to delete your account",
    );

    const wrongPasswordError = await runEffect(
      Effect.flip(DeleteAccountService.deleteAccount({ password: "wrong" })),
    );
    expect(wrongPasswordError._tag).toBe("ForbiddenError");
    expect(wrongPasswordError.message).toBe("Incorrect password");

    // Nothing was deleted by the failed attempts.
    expect(await db.selectFrom("account").execute()).toHaveLength(1);

    const result = await runEffect(
      DeleteAccountService.deleteAccount({ password: "correct-horse" }),
    );
    expect(result.deletedUserId).toBe("user-1");
    expect(await db.selectFrom("account").execute()).toHaveLength(0);
  });
});
