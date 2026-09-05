import { expect, test, type Page } from "@playwright/test";
import { Client } from "pg";

// Same credentials as the webServer env in playwright.config.ts.
const DATABASE_URL =
  "postgresql://user:password@localhost:5432/sakuga?sslmode=disable";

// Dedicated bypass identity (cookie value "bypass-oauth", see
// src/lib/auth/session.effect.ts) seeded WITHOUT a credential account, so the
// delete-account dialog asks for the typed "DELETE" confirmation instead of a
// password. The suite deletes this account; the afterAll restore (plus the
// beforeAll upsert) heals reruns.
const E2E_OAUTH_USER_ID = "e2e-oauth-user";
const E2E_OAUTH_USER_NAME = "E2E OAuth User";
const E2E_OAUTH_USER_EMAIL = "e2e-oauth@test.local";
const E2E_OAUTH_USER_USERNAME = "e2e_oauth_user";
const DELETED_USER_NAME = "Deleted user";

let client: Client;

async function gotoPage(page: Page, path: string) {
  await page.goto(path, { timeout: 30000, waitUntil: "load" });
  await page.waitForLoadState("networkidle");
}

test.beforeAll(async () => {
  client = new Client({ connectionString: DATABASE_URL });
  await client.connect();

  // The bypass session does not insert a user row; upsert it (also heals a
  // previous crashed run that stopped after anonymization). Deliberately no
  // `account` row: that is what makes this user passwordless.
  await client.query(
    `INSERT INTO "user" (id, email, name, "emailVerified", "createdAt", "updatedAt", username)
     VALUES ($1, $2, $3, false, now(), now(), $4)
     ON CONFLICT (id) DO UPDATE SET email = $2, name = $3, "deletedAt" = NULL, username = $4`,
    [
      E2E_OAUTH_USER_ID,
      E2E_OAUTH_USER_EMAIL,
      E2E_OAUTH_USER_NAME,
      E2E_OAUTH_USER_USERNAME,
    ],
  );
});

test.afterAll(async () => {
  // The suite anonymized the user; restore the row so reruns (and anything
  // referencing the identity) start from a clean, non-anonymized state.
  await client.query(
    `UPDATE "user" SET email = $2, "emailVerified" = false, image = NULL,
       name = $3, "deletedAt" = NULL, "twoFactorEnabled" = false, "updatedAt" = now()
     WHERE id = $1`,
    [E2E_OAUTH_USER_ID, E2E_OAUTH_USER_EMAIL, E2E_OAUTH_USER_NAME],
  );
  await client.end();
});

test.describe("Delete account (passwordless)", () => {
  test.beforeEach(async ({ context }) => {
    await context.addCookies([
      {
        domain: "localhost",
        name: "e2e-test-auth",
        path: "/",
        value: "bypass-oauth",
      },
    ]);
  });

  test("requires typing DELETE, then anonymizes without a password", async ({
    page,
  }) => {
    await gotoPage(page, "/account");

    const dangerZone = page.getByRole("heading", { name: "Danger zone" });
    await expect(dangerZone).toBeVisible({ timeout: 15000 });

    await page.getByRole("button", { name: "Delete account" }).click();
    const dialog = page.getByRole("alertdialog");
    await expect(dialog).toBeVisible();

    // Passwordless accounts get the typed-confirmation field, not a password
    // field, and the confirm button starts disabled.
    const confirmationInput = dialog.getByLabel("Type “DELETE” to confirm");
    await expect(confirmationInput).toBeVisible();
    await expect(
      dialog.getByRole("button", { name: "Confirm account deletion" }),
    ).toBeDisabled();

    // Wrong (or partial) text keeps the button disabled — no request is sent.
    await confirmationInput.fill("delete");
    await expect(
      dialog.getByRole("button", { name: "Confirm account deletion" }),
    ).toBeDisabled();

    // Exact phrase enables the button; confirming runs the anonymization and
    // signs the client out to home.
    await confirmationInput.fill("DELETE");
    await dialog
      .getByRole("button", { name: "Confirm account deletion" })
      .click();
    await expect(page).toHaveURL(/\/$/, { timeout: 15000 });

    // The user row is kept as an inert shell, scrubbed of identifying data.
    const rows = await client.query<{
      deletedAt: Date | null;
      email: string;
      name: string;
    }>(`SELECT "deletedAt", email, name FROM "user" WHERE id = $1`, [
      E2E_OAUTH_USER_ID,
    ]);
    const user = rows.rows[0];
    expect(user?.deletedAt).not.toBeNull();
    expect(user?.name).toBe(DELETED_USER_NAME);
    expect(user?.email).toBe(`deleted-${E2E_OAUTH_USER_ID}@deleted.local`);

    // No auth data existed to begin with, and the deletion removed any that
    // could have been created in the meantime.
    const accountRows = await client.query<{ id: string }>(
      'SELECT id FROM account WHERE "userId" = $1',
      [E2E_OAUTH_USER_ID],
    );
    expect(accountRows.rows).toHaveLength(0);
  });
});
