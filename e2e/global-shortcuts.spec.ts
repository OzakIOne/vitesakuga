import { expect, test, type Page } from "@playwright/test";

// Keyboard shortcuts (docs/features.md — Raccourcis clavier) handled by
// src/components/GlobalShortcuts.tsx:
// - `?` (Shift+/) toggles the keyboard shortcuts dialog
// - `Mod+K` (Cmd on macOS, Ctrl elsewhere) focuses the search input
// - Sequences `G P` / `G U` / `G S` navigate to /posts, /users, and focus search
const MOD_KEY = process.platform === "darwin" ? "Meta" : "Control";

const shortcutsDialog = (page: Page) =>
  page.getByRole("heading", { name: "Keyboard Shortcuts" });

// The search input is server-rendered, so it is visible before React hydrates
// and the hotkey handlers are attached. Retrying the press+assert pair makes
// each test wait for hydration instead of racing it. Retries are safe: `?`
// toggles (a reload just re-opens on the next attempt) and the other
// shortcuts are idempotent.
function pressAndAssert(
  page: Page,
  press: () => Promise<void>,
  assert: () => Promise<void>,
) {
  return expect(async () => {
    await press();
    await assert();
  }).toPass({ timeout: 15000 });
}

async function gotoHome(page: Page) {
  await page.goto("/", { timeout: 30000, waitUntil: "load" });
  await expect(page.locator("#search-input")).toBeVisible({ timeout: 15000 });
}

test.describe("GlobalShortcuts", () => {
  test.beforeEach(async ({ context }) => {
    // Same e2e auth bypass as convert.spec.ts so /posts and /users render.
    await context.addCookies([
      {
        domain: "localhost",
        name: "e2e-test-auth",
        path: "/",
        value: "bypass",
      },
    ]);
  });

  test("`?` opens the keyboard shortcuts dialog", async ({ page }) => {
    await gotoHome(page);

    await pressAndAssert(
      page,
      () => page.keyboard.press("Shift+Slash"),
      async () => {
        await expect(shortcutsDialog(page)).toBeVisible();
        // The dialog lists the documented shortcuts.
        await expect(page.getByText("Navigate to Posts")).toBeVisible();
        await expect(page.getByText("Navigate to Users")).toBeVisible();
        await expect(page.getByText("Show keyboard shortcuts")).toBeVisible();
      },
    );
  });

  test("`?` button opens the dialog and close trigger closes it", async ({
    page,
  }) => {
    await gotoHome(page);

    await pressAndAssert(
      page,
      () => page.getByRole("button", { name: "Keyboard shortcuts" }).click(),
      () => expect(shortcutsDialog(page)).toBeVisible(),
    );

    await pressAndAssert(
      page,
      () =>
        page.getByRole("button", { name: "Close keyboard shortcuts" }).click(),
      () => expect(shortcutsDialog(page)).toBeHidden(),
    );
  });

  test("Mod+K focuses the search input", async ({ page }) => {
    await gotoHome(page);

    await pressAndAssert(
      page,
      () => page.keyboard.press(`${MOD_KEY}+k`),
      () => expect(page.locator("#search-input")).toBeFocused(),
    );
  });

  test("G then P navigates to posts", async ({ page }) => {
    await gotoHome(page);

    await pressAndAssert(
      page,
      async () => {
        await page.keyboard.press("g");
        await page.keyboard.press("p");
      },
      () => expect(page).toHaveURL(/\/posts(\?|$)/),
    );
  });

  test("G then U navigates to users", async ({ page }) => {
    await gotoHome(page);

    await pressAndAssert(
      page,
      async () => {
        await page.keyboard.press("g");
        await page.keyboard.press("u");
      },
      () => expect(page).toHaveURL(/\/users(\?|$)/),
    );
  });

  test("G then S focuses the search input", async ({ page }) => {
    await gotoHome(page);

    await pressAndAssert(
      page,
      async () => {
        await page.keyboard.press("g");
        await page.keyboard.press("s");
      },
      () => expect(page.locator("#search-input")).toBeFocused(),
    );
  });
});
