import { expect, test, type Page } from "@playwright/test";
import { Client } from "pg";

// Same credentials as the webServer env in playwright.config.ts.
const DATABASE_URL =
  "postgresql://user:password@localhost:5432/sakuga?sslmode=disable";

// The auth bypass session (see src/lib/auth/session.effect.ts) comments as
// this user; the second account is the @mention target.
const E2E_USER_ID = "e2e-test-user";
const E2E_USER_NAME = "E2E Test User";
const E2E_USER_USERNAME = "e2e_test_user";
const BUDDY_USER_ID = "e2e-buddy-user";
const BUDDY_USERNAME = "e2e_buddy";
const BUDDY_NAME = "E2E Buddy";

let postId = 0;
let client: Client;

async function gotoPost(page: Page) {
  await page.goto(`/posts/${postId}`, { timeout: 30000, waitUntil: "load" });
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible({
    timeout: 15000,
  });
  // The page is server-rendered; React hydration happens ~1s later and resets
  // any input made before it. Wait for the app to finish loading so fills are
  // not discarded.
  await page.waitForLoadState("networkidle");
}

/** Comment body paragraph — getByText alone would also match the composer textarea value. */
function commentBody(page: Page, text: string) {
  return page.getByRole("paragraph").filter({ hasText: text });
}

async function submitComment(page: Page, content: string) {
  const textarea = page.getByLabel("Write a comment");
  await textarea.fill(content);
  await page.getByRole("button", { name: "Add Comment" }).click();
}

test.beforeAll(async () => {
  client = new Client({ connectionString: DATABASE_URL });
  await client.connect();

  // The bypass user owns the post; the buddy is the @mention target. Both
  // rows are upserted so repeated runs stay idempotent; `username` is NOT
  // NULL (the @mention handle).
  await client.query(
    `INSERT INTO "user" (id, email, name, "emailVerified", "createdAt", "updatedAt", username)
     VALUES ($1, 'e2e@test.local', $2, false, now(), now(), $3)
     ON CONFLICT (id) DO UPDATE SET name = $2, "deletedAt" = NULL, username = $3`,
    [E2E_USER_ID, E2E_USER_NAME, E2E_USER_USERNAME],
  );
  await client.query(
    `INSERT INTO "user" (id, email, name, "emailVerified", "createdAt", "updatedAt", username)
     VALUES ($1, $2, $3, false, now(), now(), $4)
     ON CONFLICT (id) DO UPDATE SET name = $3, "deletedAt" = NULL, username = $4`,
    [BUDDY_USER_ID, "e2e-buddy@test.local", BUDDY_NAME, BUDDY_USERNAME],
  );

  const result = await client.query<{ id: number }>(
    `INSERT INTO posts (description, "thumbnailKey", title, "userId", "videoMetadata")
     VALUES ('Post used by the mentions e2e suite.', 'e2e/comments.png', $1, $2, '{}')
     RETURNING id`,
    [`E2E Mentions ${Date.now()}`, E2E_USER_ID],
  );
  const inserted = result.rows[0];
  if (!inserted) {
    throw new Error("Failed to create the e2e mentions test post");
  }
  postId = inserted.id;
});

test.afterAll(async () => {
  // posts cascade to comments, comment mentions and post votes; the buddy
  // user cascades to its notifications and mention rows.
  await client.query("DELETE FROM posts WHERE id = $1", [postId]);
  await client.query('DELETE FROM "user" WHERE id = $1', [BUDDY_USER_ID]);
  await client.end();
});

test.describe("Comment mentions", () => {
  test.beforeEach(async ({ context, page }) => {
    // Fresh comment list and inbox per test so DB assertions stay unambiguous.
    await client.query('DELETE FROM comments WHERE "postId" = $1', [postId]);
    await client.query('DELETE FROM notifications WHERE "userId" = $1', [
      BUDDY_USER_ID,
    ]);

    await context.addCookies([
      {
        domain: "localhost",
        name: "e2e-test-auth",
        path: "/",
        value: "bypass",
      },
    ]);
    await gotoPost(page);
  });

  test("suggests users after typing @", async ({ page }) => {
    const textarea = page.getByLabel("Write a comment");
    await textarea.fill("@e2e_b");

    const listbox = page.getByRole("listbox", { name: "User suggestions" });
    await expect(listbox).toBeVisible();
    await expect(
      listbox.getByRole("option", { name: new RegExp(`@${BUDDY_USERNAME}`) }),
    ).toBeVisible();
  });

  test("inserts the picked handle at the caret", async ({ page }) => {
    const textarea = page.getByLabel("Write a comment");
    await textarea.fill("@e2e_b");

    await page
      .getByRole("option", { name: new RegExp(`@${BUDDY_USERNAME}`) })
      .click();

    // The partial handle is replaced by `@username ` and the dropdown closes.
    await expect(textarea).toHaveValue(`@${BUDDY_USERNAME} `);
    await expect(
      page.getByRole("listbox", { name: "User suggestions" }),
    ).toBeHidden();
  });

  test("closes the dropdown when the handle prefix is cleared", async ({
    page,
  }) => {
    const textarea = page.getByLabel("Write a comment");
    await textarea.fill("@e2e_b");
    await expect(
      page.getByRole("listbox", { name: "User suggestions" }),
    ).toBeVisible();

    await textarea.fill("no mention here");
    await expect(
      page.getByRole("listbox", { name: "User suggestions" }),
    ).toBeHidden();
  });

  test("renders a posted mention as a profile link", async ({ page }) => {
    await submitComment(page, `Hello @${BUDDY_USERNAME}, nice post!`);
    const paragraph = commentBody(page, `Hello @${BUDDY_USERNAME}, nice post!`);
    await expect(paragraph).toBeVisible();

    const mentionLink = paragraph.getByRole("link", {
      name: `@${BUDDY_USERNAME}`,
    });
    await expect(mentionLink).toBeVisible();
    await expect(mentionLink).toHaveAttribute(
      "href",
      `/users/${BUDDY_USER_ID}`,
    );
  });

  test("renders an unknown handle as plain text", async ({ page }) => {
    await submitComment(page, "Pinging @ghost_who_does_not_exist directly");
    const paragraph = commentBody(
      page,
      "Pinging @ghost_who_does_not_exist directly",
    );
    await expect(paragraph).toBeVisible();

    // No link inside the paragraph: the unresolved handle is literal text.
    await expect(paragraph.getByRole("link")).toHaveCount(0);
  });

  test("notifies the mentioned user", async ({ page }) => {
    await submitComment(page, `Ping @${BUDDY_USERNAME} for review`);
    // The optimistic row renders plain text; the mention link only appears
    // once the server has resolved the mention, so waiting for it proves the
    // server function completed before the DB assertions below.
    await expect(
      commentBody(page, `Ping @${BUDDY_USERNAME} for review`).getByRole(
        "link",
        {
          name: `@${BUDDY_USERNAME}`,
        },
      ),
    ).toBeVisible();

    const result = await client.query<{
      type: string;
      postId: number;
    }>(
      `SELECT type, "postId" FROM notifications WHERE "userId" = $1 AND type = 'comment-mention'`,
      [BUDDY_USER_ID],
    );
    expect(result.rows).toContainEqual({ type: "comment-mention", postId });

    const mentions = await client.query<{ userId: string }>(
      `SELECT cm."userId" FROM comment_mentions cm
       JOIN comments c ON c.id = cm."commentId"
       WHERE c."postId" = $1`,
      [postId],
    );
    expect(mentions.rows.map((row) => row.userId)).toContain(BUDDY_USER_ID);
  });

  test("does not notify for an unknown handle", async ({ page }) => {
    await submitComment(
      page,
      "Nothing to notify here @ghost_who_does_not_exist",
    );

    await expect(commentBody(page, "Nothing to notify here")).toBeVisible();
    const result = await client.query<{ count: string }>(
      `SELECT count(*) FROM notifications WHERE "userId" = $1`,
      [BUDDY_USER_ID],
    );
    expect(result.rows[0]?.count).toBe("0");
  });
});
