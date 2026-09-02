import { expect, test, type Page } from "@playwright/test";
import { Client } from "pg";

// Same credentials as the webServer env in playwright.config.ts.
const DATABASE_URL =
  "postgresql://user:password@localhost:5432/sakuga?sslmode=disable";

// The auth bypass session (see src/lib/auth/session.effect.ts) authenticates
// as this user, so the post and every comment created below is owned by it.
const E2E_USER_ID = "e2e-test-user";
const E2E_USER_NAME = "E2E Test User";
const E2E_USER_USERNAME = "e2e_test_user";

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

test.beforeAll(async () => {
  client = new Client({ connectionString: DATABASE_URL });
  await client.connect();

  // The bypass session does not insert a user row, but posts and comments
  // reference user.id — upsert it so the FK constraints hold. Timestamps and
  // flags are set explicitly so the insert works with or without DB defaults.
  // `username` is NOT NULL (the @mention handle).
  await client.query(
    `INSERT INTO "user" (id, email, name, "emailVerified", "createdAt", "updatedAt", username)
     VALUES ($1, 'e2e@test.local', $2, false, now(), now(), $3)
     ON CONFLICT (id) DO UPDATE SET name = $2, "deletedAt" = NULL, username = $3`,
    [E2E_USER_ID, E2E_USER_NAME, E2E_USER_USERNAME],
  );

  const result = await client.query<{ id: number }>(
    `INSERT INTO posts (description, "thumbnailKey", title, "userId", "videoMetadata")
     VALUES ('Post used by the comments e2e suite.', 'e2e/comments.png', $1, $2, '{}')
     RETURNING id`,
    [`E2E Comments ${Date.now()}`, E2E_USER_ID],
  );
  const inserted = result.rows[0];
  if (!inserted) {
    throw new Error("Failed to create the e2e comments test post");
  }
  postId = inserted.id;
});

test.afterAll(async () => {
  // posts cascade to comments, post votes, etc.
  await client.query("DELETE FROM posts WHERE id = $1", [postId]);
  await client.end();
});

test.describe("Comments", () => {
  test.beforeEach(async ({ context, page }) => {
    // Fresh comment list per test so locators stay unambiguous: every test
    // creates its own comment and the post author is the same bypass user.
    await client.query('DELETE FROM comments WHERE "postId" = $1', [postId]);

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

  test("posts a comment and clears the draft", async ({ page }) => {
    const textarea = page.getByLabel("Write a comment");
    await textarea.fill("A brand new e2e comment");

    await page.getByRole("button", { name: "Add Comment" }).click();

    await expect(commentBody(page, "A brand new e2e comment")).toBeVisible();
    await expect(textarea).toHaveValue("");
  });

  test("keeps the draft across page reloads", async ({ page }) => {
    const textarea = page.getByLabel("Write a comment");
    await textarea.fill("Draft that survives a reload");

    // The draft is persisted with a 500ms debounce; wait past it.
    await page.waitForTimeout(700);
    await page.reload({ waitUntil: "load" });
    await page.waitForLoadState("networkidle");

    await expect(page.getByLabel("Write a comment")).toHaveValue(
      "Draft that survives a reload",
    );
  });

  test("edits an own comment", async ({ page }) => {
    const textarea = page.getByLabel("Write a comment");
    await textarea.fill("Comment before edit");
    await page.getByRole("button", { name: "Add Comment" }).click();
    await expect(commentBody(page, "Comment before edit")).toBeVisible();

    await page.getByRole("button", { name: "Edit comment" }).click();
    const editTextarea = page.getByRole("textbox", { name: "Edit comment" });
    await editTextarea.fill("Comment after edit");
    await page.getByRole("button", { name: "Save" }).click();

    await expect(commentBody(page, "Comment after edit")).toBeVisible();
    await expect(commentBody(page, "Comment before edit")).toBeHidden();
  });

  test("deletes an own comment after confirmation", async ({ page }) => {
    const textarea = page.getByLabel("Write a comment");
    await textarea.fill("Comment doomed to deletion");
    await page.getByRole("button", { name: "Add Comment" }).click();
    await expect(commentBody(page, "Comment doomed to deletion")).toBeVisible();

    await page.getByRole("button", { name: "Delete comment" }).click();
    const dialog = page.getByRole("alertdialog");
    await expect(dialog).toBeVisible();
    await dialog.getByRole("button", { name: "Delete Comment" }).click();

    await expect(commentBody(page, "Comment doomed to deletion")).toBeHidden();
  });

  test("links the commenter name to their profile", async ({ page }) => {
    const textarea = page.getByLabel("Write a comment");
    await textarea.fill("Comment with a profile link");
    await page.getByRole("button", { name: "Add Comment" }).click();
    await expect(
      commentBody(page, "Comment with a profile link"),
    ).toBeVisible();

    await page.getByRole("link", { name: E2E_USER_NAME }).first().click();

    await expect(page).toHaveURL(new RegExp(`/users/${E2E_USER_ID}`));
  });
});
