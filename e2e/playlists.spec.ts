import { expect, test, type Page } from "@playwright/test";
import { Client } from "pg";

// Same credentials as the webServer env in playwright.config.ts.
const DATABASE_URL =
  "postgresql://user:password@localhost:5432/sakuga?sslmode=disable";

// The auth bypass session (see src/lib/auth/session.effect.ts) authenticates
// as this user, so the posts and playlist created below are owned by it.
const E2E_USER_ID = "e2e-test-user";
const E2E_USER_NAME = "E2E Test User";
const E2E_USER_USERNAME = "e2e_test_user";

// Reordering (docs/features.md priority 3) is implemented via dnd-kit: the
// manage table enables dragging once every playlist page is loaded, since the
// `reorderPlaylistPosts` server function requires the submitted items to
// cover every post exactly once.

let playlistId = 0;
let postIds: number[] = [];
let client: Client;
let title: (index: number) => string;

async function gotoPlaylist(page: Page) {
  await page.goto(`/account/playlists/${playlistId}`, {
    timeout: 30000,
    waitUntil: "load",
  });
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible({
    timeout: 15000,
  });
  // The page is server-rendered; React hydration happens ~1s later and resets
  // any input made before it. Wait for the app to finish loading so fills are
  // not discarded.
  await page.waitForLoadState("networkidle");
}

/** Seed all e2e posts into the playlist at their natural order. */
async function seedAllPosts() {
  for (const [index, postId] of postIds.entries()) {
    await client.query(
      `INSERT INTO playlist_posts (playlist_id, post_id, position)
       VALUES ($1, $2, $3)`,
      [playlistId, postId, index],
    );
  }
}

/** Post-title links appear in DOM order, which matches the row order. */
async function expectRowOrder(page: Page, expected: number[]) {
  const rendered = await page
    .getByRole("link", { name: /E2E Playlists/ })
    .allTextContents();
  expect(rendered).toEqual(expected.map((index) => title(index)));
}

async function expectDbOrder(expected: number[]) {
  const result = await client.query<{ post_id: number }>(
    `SELECT post_id FROM playlist_posts WHERE playlist_id = $1 ORDER BY position ASC`,
    [playlistId],
  );
  expect(result.rows.map((row) => row.post_id)).toEqual(
    expected.map((index) => postIds[index]),
  );
}

test.beforeAll(async ({ browser }) => {
  test.setTimeout(120000);

  client = new Client({ connectionString: DATABASE_URL });
  await client.connect();

  // The bypass session does not insert a user row, but playlists and posts
  // reference user.id — upsert it so the FK constraints hold.
  await client.query(
    `INSERT INTO "user" (id, email, name, "emailVerified", "createdAt", "updatedAt", username)
     VALUES ($1, 'e2e@test.local', $2, false, now(), now(), $3)
     ON CONFLICT (id) DO UPDATE SET name = $2, "deletedAt" = NULL, username = $3`,
    [E2E_USER_ID, E2E_USER_NAME, E2E_USER_USERNAME],
  );

  const stamp = Date.now();
  title = (index: number) => `E2E Playlists ${stamp} — post ${index}`;

  for (let index = 0; index < 3; index += 1) {
    const result = await client.query<{ id: number }>(
      `INSERT INTO posts (description, "thumbnailKey", title, "userId", "videoMetadata")
       VALUES ('Post used by the playlists e2e suite.', 'e2e/playlists.png', $1, $2, '{}')
       RETURNING id`,
      [title(index), E2E_USER_ID],
    );
    const inserted = result.rows[0];
    if (!inserted) {
      throw new Error("Failed to create the e2e playlists test post");
    }
    postIds.push(inserted.id);
  }

  const playlist = await client.query<{ id: number }>(
    `INSERT INTO playlists (title, user_id, is_public)
     VALUES ($1, $2, false)
     RETURNING id`,
    [`E2E Playlist ${Date.now()}`, E2E_USER_ID],
  );
  const insertedPlaylist = playlist.rows[0];
  if (!insertedPlaylist) {
    throw new Error("Failed to create the e2e playlists test playlist");
  }
  playlistId = insertedPlaylist.id;

  // Warm up the route: the first navigation after a fresh dev-server start
  // triggers on-demand compilation and can exceed the per-test goto timeout.
  const context = await browser.newContext();
  await context.addCookies([
    {
      domain: "localhost",
      name: "e2e-test-auth",
      path: "/",
      value: "bypass",
    },
  ]);
  const warmup = await context.newPage();
  await warmup.goto(`/account/playlists/${playlistId}`, {
    timeout: 60000,
    waitUntil: "load",
  });
  await context.close();
});

test.afterAll(async () => {
  // Posts cascade to playlist_posts and comments; the playlist cascades to
  // its remaining playlist_posts rows.
  await client.query("DELETE FROM posts WHERE id = ANY($1::int[])", [postIds]);
  await client.query("DELETE FROM playlists WHERE id = $1", [playlistId]);
  await client.end();
});

test.describe("Playlists UI", () => {
  test.beforeEach(async ({ context, page }) => {
    // Start each test with an empty playlist so locators and the success
    // summary ("Added N, skipped M...") stay unambiguous.
    await client.query("DELETE FROM playlist_posts WHERE playlist_id = $1", [
      playlistId,
    ]);

    await context.addCookies([
      {
        domain: "localhost",
        name: "e2e-test-auth",
        path: "/",
        value: "bypass",
      },
    ]);
    await gotoPlaylist(page);
  });

  test("bulk adds posts by ID", async ({ page }) => {
    const input = page.getByPlaceholder("e.g. 12, 45, 67");
    await input.fill(`${postIds[0]}, ${postIds[1]}`);
    await page.getByRole("button", { name: "Add posts" }).click();

    await expect(
      page.getByText("Added 2, skipped 0 already in playlist, 0 not found."),
    ).toBeVisible();
    await expect(page.getByRole("link", { name: title(0) })).toBeVisible();
    await expect(page.getByRole("link", { name: title(1) })).toBeVisible();
  });

  test("skips posts that are already in the playlist", async ({ page }) => {
    await client.query(
      `INSERT INTO playlist_posts (playlist_id, post_id, position)
       VALUES ($1, $2, 0)`,
      [playlistId, postIds[0]],
    );
    await page.reload({ waitUntil: "load" });
    await page.waitForLoadState("networkidle");

    const input = page.getByPlaceholder("e.g. 12, 45, 67");
    await input.fill(`${postIds[0]} ${postIds[1]}`);
    await page.getByRole("button", { name: "Add posts" }).click();

    await expect(
      page.getByText("Added 1, skipped 1 already in playlist, 0 not found."),
    ).toBeVisible();
    await expect(page.getByRole("link", { name: title(1) })).toBeVisible();
  });

  test("reports unknown post IDs without adding anything", async ({ page }) => {
    const input = page.getByPlaceholder("e.g. 12, 45, 67");
    await input.fill("999999999");
    await page.getByRole("button", { name: "Add posts" }).click();

    await expect(
      page.getByText("Added 0, skipped 0 already in playlist, 1 not found."),
    ).toBeVisible();
    await expect(page.getByText("This playlist is empty")).toBeVisible();
  });

  test("rejects input without a valid post ID", async ({ page }) => {
    const input = page.getByPlaceholder("e.g. 12, 45, 67");
    await input.fill("not-an-id");
    await page.getByRole("button", { name: "Add posts" }).click();

    await expect(
      page.getByText("Enter at least one valid post ID"),
    ).toBeVisible();
    await expect(page.getByText("This playlist is empty")).toBeVisible();
  });

  test("bulk removes selected posts after confirmation", async ({ page }) => {
    const rows = postIds.map((postId, index) => ({ postId, index }));
    for (const { postId, index } of rows) {
      await client.query(
        `INSERT INTO playlist_posts (playlist_id, post_id, position)
         VALUES ($1, $2, $3)`,
        [playlistId, postId, index],
      );
    }
    await page.reload({ waitUntil: "load" });
    await page.waitForLoadState("networkidle");

    for (const postId of postIds) {
      await page.getByLabel(`Select row ${postId}`).check();
    }
    await page.getByRole("button", { name: "Remove selected (3)" }).click();

    const dialog = page.getByRole("alertdialog");
    await expect(dialog).toBeVisible();
    await dialog.getByRole("button", { name: "Remove 3 posts" }).click();

    await expect(page.getByText("This playlist is empty")).toBeVisible();
    await expect(page.getByRole("link", { name: title(0) })).toBeHidden();
  });

  test("reorders posts via drag and drop", async ({ page }) => {
    await seedAllPosts();
    await page.reload({ waitUntil: "load" });
    await page.waitForLoadState("networkidle");
    await expectRowOrder(page, [0, 1, 2]);

    // Drag the first row's handle onto the last row.
    await page.getByLabel(`Drag to reorder ${title(0)}`).hover();
    await page.mouse.down();
    const target = await page
      .getByRole("link", { name: title(2) })
      .boundingBox();
    if (!target) {
      throw new Error("Target row not rendered");
    }
    await page.mouse.move(
      target.x + target.width / 2,
      target.y + target.height / 2,
      {
        steps: 10,
      },
    );
    await page.mouse.up();

    // The success toast doubles as a sync point for the reorder mutation.
    await expect(page.getByText("Playlist reordered")).toBeVisible();
    await expectRowOrder(page, [1, 2, 0]);
    await expectDbOrder([1, 2, 0]);
  });

  test("reorders posts with the keyboard", async ({ page }) => {
    await seedAllPosts();
    await page.reload({ waitUntil: "load" });
    await page.waitForLoadState("networkidle");
    await expectRowOrder(page, [0, 1, 2]);

    const handle = page.getByLabel(`Drag to reorder ${title(1)}`);
    await handle.focus();
    await page.keyboard.press("Space"); // lift
    await page.waitForTimeout(200);
    await page.keyboard.press("ArrowDown"); // move below the last row
    await page.waitForTimeout(200);
    await page.keyboard.press("Space"); // drop

    await expect(page.getByText("Playlist reordered")).toBeVisible();
    await expectRowOrder(page, [0, 2, 1]);
    await expectDbOrder([0, 2, 1]);
  });
});
