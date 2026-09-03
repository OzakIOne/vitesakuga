import { expect, test, type Page } from "@playwright/test";
import { hashPassword } from "better-auth/crypto";
import { Client } from "pg";

// Same credentials as the webServer env in playwright.config.ts.
const DATABASE_URL =
  "postgresql://user:password@localhost:5432/sakuga?sslmode=disable";

// The auth bypass session (see src/lib/auth/session.effect.ts) authenticates
// as this user. The suite deletes this account, so every row it seeds is
// either asserted on after anonymization or cleaned up/restored in afterAll.
const E2E_USER_ID = "e2e-test-user";
const E2E_USER_NAME = "E2E Test User";
const E2E_USER_USERNAME = "e2e_test_user";
const E2E_USER_EMAIL = "e2e@test.local";
const DELETED_USER_NAME = "Deleted user";
const ACCOUNT_PASSWORD = "correct-horse-battery";

let postId = 0;
let client: Client;

async function gotoPage(page: Page, path: string) {
  await page.goto(path, { timeout: 30000, waitUntil: "load" });
  await page.waitForLoadState("networkidle");
}

test.beforeAll(async () => {
  client = new Client({ connectionString: DATABASE_URL });
  await client.connect();

  // The bypass session does not insert a user row; upsert it (also heals a
  // previous crashed run that stopped after anonymization).
  await client.query(
    `INSERT INTO "user" (id, email, name, "emailVerified", "createdAt", "updatedAt", username)
     VALUES ($1, $2, $3, false, now(), now(), $4)
     ON CONFLICT (id) DO UPDATE SET email = $2, name = $3, "deletedAt" = NULL, username = $4`,
    [E2E_USER_ID, E2E_USER_EMAIL, E2E_USER_NAME, E2E_USER_USERNAME],
  );

  // A credential account makes the UI require the password before deletion
  // (hasPassword=true) and lets the suite assert the scrub of auth data.
  const passwordHash = await hashPassword(ACCOUNT_PASSWORD);
  await client.query(
    `INSERT INTO account (id, "accountId", "providerId", password, "userId", "createdAt", "updatedAt")
     VALUES ('e2e-test-account', $1, 'credential', $2, $1, now(), now())
     ON CONFLICT (id) DO UPDATE SET password = $2, "userId" = $1`,
    [E2E_USER_ID, passwordHash],
  );

  const result = await client.query<{ id: number }>(
    `INSERT INTO posts (description, "thumbnailKey", title, "userId", "videoMetadata")
     VALUES ('Post used by the delete-account e2e suite.', 'e2e/delete-account.png', $1, $2, '{}')
     RETURNING id`,
    [`E2E Delete Account ${Date.now()}`, E2E_USER_ID],
  );
  const inserted = result.rows[0];
  if (!inserted) {
    throw new Error("Failed to create the e2e delete-account test post");
  }
  postId = inserted.id;

  // Public content that must survive anonymization, attributed to
  // "Deleted user" afterwards.
  await client.query(
    'INSERT INTO comments (content, "postId", "userId") VALUES ($1, $2, $3)',
    ["Comment that outlives its author", postId, E2E_USER_ID],
  );
  // Votes are kept on purpose (see src/lib/auth/delete-account.ts).
  await client.query(
    'INSERT INTO post_votes ("postId", "userId", vote) VALUES ($1, $2, $3) ON CONFLICT DO NOTHING',
    [postId, E2E_USER_ID, "like"],
  );
});

test.afterAll(async () => {
  // posts cascade to comments and post_votes. The bypass user is shared by
  // the other suites — restore it so they find a clean, non-anonymized row.
  await client.query("DELETE FROM posts WHERE id = $1", [postId]);
  await client.query('DELETE FROM account WHERE "userId" = $1', [E2E_USER_ID]);
  await client.query('DELETE FROM playlists WHERE "user_id" = $1', [
    E2E_USER_ID,
  ]);
  await client.query(
    `UPDATE "user" SET email = $2, "emailVerified" = false, image = NULL,
       name = $3, "deletedAt" = NULL, "twoFactorEnabled" = false, "updatedAt" = now()
     WHERE id = $1`,
    [E2E_USER_ID, E2E_USER_EMAIL, E2E_USER_NAME],
  );
  await client.end();
});

test.describe("Delete account", () => {
  test.beforeEach(async ({ context }) => {
    await context.addCookies([
      {
        domain: "localhost",
        name: "e2e-test-auth",
        path: "/",
        value: "bypass",
      },
    ]);
  });

  test("rejects a wrong password, then anonymizes instead of deleting", async ({
    page,
  }) => {
    await gotoPage(page, "/account");

    const dangerZone = page.getByRole("heading", { name: "Danger zone" });
    await expect(dangerZone).toBeVisible({ timeout: 15000 });

    await page.getByRole("button", { name: "Delete account" }).click();
    const dialog = page.getByRole("alertdialog");
    await expect(dialog).toBeVisible();
    await expect(dialog.getByText(DELETED_USER_NAME)).toBeVisible();

    // Wrong password: the server rejects, the account stays intact.
    await dialog.getByLabel("Confirm your password").fill("wrong-password");
    await dialog
      .getByRole("button", { name: "Confirm account deletion" })
      .click();
    await expect(page.getByText("Error deleting account")).toBeVisible();

    const rows = await client.query<{ deletedAt: Date | null }>(
      'SELECT "deletedAt" FROM "user" WHERE id = $1',
      [E2E_USER_ID],
    );
    expect(rows.rows[0]?.deletedAt).toBeNull();
    // Correct password: deletion runs and the client signs out to home.
    await dialog.getByLabel("Confirm your password").fill(ACCOUNT_PASSWORD);
    await dialog
      .getByRole("button", { name: "Confirm account deletion" })
      .click();
    await expect(page).toHaveURL(/\/$/, { timeout: 15000 });

    // The user row is kept as an inert shell, scrubbed of identifying data.
    const anonymizedRows = await client.query<{
      deletedAt: Date | null;
      email: string;
      emailVerified: boolean;
      image: string | null;
      name: string;
    }>(
      `SELECT "deletedAt", email, "emailVerified", image, name
       FROM "user" WHERE id = $1`,
      [E2E_USER_ID],
    );
    const user = anonymizedRows.rows[0];
    expect(user?.deletedAt).not.toBeNull();
    expect(user?.name).toBe(DELETED_USER_NAME);
    expect(user?.email).toBe(`deleted-${E2E_USER_ID}@deleted.local`);
    expect(user?.emailVerified).toBe(false);
    expect(user?.image).toBeNull();

    // Everything that could re-authenticate the person is removed.
    const authRows = await client.query<{ kind: string }>(
      `SELECT 'account' AS kind FROM account WHERE "userId" = $1
       UNION ALL
       SELECT 'session' FROM session WHERE "userId" = $1
       UNION ALL
       SELECT 'passkey' FROM passkey WHERE "userId" = $1
       UNION ALL
       SELECT 'two_factor' FROM "twoFactor" WHERE "userId" = $1`,
      [E2E_USER_ID],
    );
    expect(authRows.rows).toHaveLength(0);

    // Personal data (playlists) is removed with their posts.
    const playlistRows = await client.query<{ id: number }>(
      "SELECT id FROM playlists WHERE user_id = $1",
      [E2E_USER_ID],
    );
    expect(playlistRows.rows).toHaveLength(0);

    // Public content survives and is now attributed to "Deleted user";
    // votes are kept so public counts don't silently change.
    await gotoPage(page, `/posts/${postId}`);
    await expect(
      page
        .getByRole("paragraph")
        .filter({ hasText: "Comment that outlives its author" }),
    ).toBeVisible();
    await expect(
      page.getByRole("link", { name: DELETED_USER_NAME }).first(),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Like post", exact: true }),
    ).toHaveText("1");
  });
});
