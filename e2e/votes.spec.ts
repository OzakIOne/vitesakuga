import { expect, test, type Page } from "@playwright/test";
import { Client } from "pg";

// Same credentials as the webServer env in playwright.config.ts.
const DATABASE_URL =
  "postgresql://user:password@localhost:5432/sakuga?sslmode=disable";

// The auth bypass session (see src/lib/auth/session.effect.ts) authenticates
// as this user, so votes are cast by it.
const E2E_USER_ID = "e2e-test-user";

let postId = 0;
let client: Client;

async function gotoPost(page: Page) {
  await page.goto(`/posts/${postId}`, { timeout: 30000, waitUntil: "load" });
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible({
    timeout: 15000,
  });
  // The page is server-rendered and the votes summary loads through a
  // separate query; wait for the network to settle so counts are accurate
  // before clicking.
  await page.waitForLoadState("networkidle");
}

/** Vote buttons expose aria-label + aria-pressed (see PostVoteButtons). */
function voteButton(page: Page, name: "Like post" | "Dislike post") {
  // exact:true — role-name matching is substring-based otherwise, so
  // "Like post" would also resolve "Dislike post".
  return page.getByRole("button", { name, exact: true });
}

/**
 * The UI updates optimistically before the server confirms; poll the DB so
 * direct-SQL assertions don't race the in-flight mutation.
 */
async function expectVoteRows(expected: Array<{ vote: string }>) {
  await expect
    .poll(
      async () => {
        const rows = await client.query<{ vote: string }>(
          'SELECT vote FROM post_votes WHERE "postId" = $1 AND "userId" = $2',
          [postId, E2E_USER_ID],
        );
        return rows.rows;
      },
      { timeout: 5000 },
    )
    .toEqual(expected);
}

test.beforeAll(async () => {
  client = new Client({ connectionString: DATABASE_URL });
  await client.connect();

  // The bypass session does not insert a user row, but post_votes reference
  // user.id — upsert it so the FK constraints hold.
  await client.query(
    `INSERT INTO "user" (id, email, name, "emailVerified", "createdAt", "updatedAt", username)
     VALUES ($1, 'e2e@test.local', 'E2E Test User', false, now(), now(), 'e2e_test_user')
     ON CONFLICT (id) DO UPDATE SET "deletedAt" = NULL`,
    [E2E_USER_ID],
  );

  const result = await client.query<{ id: number }>(
    `INSERT INTO posts (description, "thumbnailKey", title, "userId", "videoMetadata")
     VALUES ('Post used by the votes e2e suite.', 'e2e/votes.png', $1, $2, '{}')
     RETURNING id`,
    [`E2E Votes ${Date.now()}`, E2E_USER_ID],
  );
  const inserted = result.rows[0];
  if (!inserted) {
    throw new Error("Failed to create the e2e votes test post");
  }
  postId = inserted.id;
});

test.afterAll(async () => {
  // posts cascade to post_votes.
  await client.query("DELETE FROM posts WHERE id = $1", [postId]);
  await client.end();
});

test.describe("Votes", () => {
  test.beforeEach(async ({ context, page }) => {
    // Fresh vote state per test so counts and locators stay unambiguous.
    await client.query('DELETE FROM post_votes WHERE "postId" = $1', [postId]);

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

  test("upvotes a post and persists the vote after reload", async ({
    page,
  }) => {
    const likeButton = voteButton(page, "Like post");
    await expect(likeButton).toHaveText("0");
    await expect(likeButton).toHaveAttribute("aria-pressed", "false");

    await likeButton.click();

    // Optimistic update: the count flips immediately.
    await expect(likeButton).toHaveAttribute("aria-pressed", "true");
    await expect(likeButton).toHaveText("1");
    await expectVoteRows([{ vote: "like" }]);

    await page.reload({ waitUntil: "load" });
    await page.waitForLoadState("networkidle");

    await expect(voteButton(page, "Like post")).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    await expect(voteButton(page, "Like post")).toHaveText("1");
    await expectVoteRows([{ vote: "like" }]);
  });

  test("switches a like to a dislike", async ({ page }) => {
    const likeButton = voteButton(page, "Like post");
    const dislikeButton = voteButton(page, "Dislike post");

    await likeButton.click();
    await expect(likeButton).toHaveAttribute("aria-pressed", "true");

    await dislikeButton.click();

    await expect(dislikeButton).toHaveAttribute("aria-pressed", "true");
    await expect(dislikeButton).toHaveText("1");
    await expect(likeButton).toHaveAttribute("aria-pressed", "false");
    await expect(likeButton).toHaveText("0");
    await expectVoteRows([{ vote: "dislike" }]);
  });

  test("removes the vote when clicking the active vote again", async ({
    page,
  }) => {
    const likeButton = voteButton(page, "Like post");

    await likeButton.click();
    await expect(likeButton).toHaveAttribute("aria-pressed", "true");

    await likeButton.click();

    await expect(likeButton).toHaveAttribute("aria-pressed", "false");
    await expect(likeButton).toHaveText("0");
    await expectVoteRows([]);
  });
});
