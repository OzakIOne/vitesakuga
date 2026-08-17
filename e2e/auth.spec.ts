import { expect, test, type Page } from "@playwright/test";

// The header renders account links twice: in the desktop nav and inside the
// mobile menu (display:none at the default desktop viewport). Role locators
// for "Account"/"Login" therefore match both variants, so filter to the
// visible one. "Sign Out" is scoped to its button role because the mobile
// menu renders it as a menuitem.
function visibleHeaderLink(page: Page, name: string) {
  return page.getByRole("link", { name }).filter({ visible: true });
}

test.describe("Auth flow", () => {
  test("login page renders form", async ({ page }) => {
    await page.goto("/login", { timeout: 30000, waitUntil: "load" });

    await expect(page.locator("#email")).toBeVisible({ timeout: 10000 });
    await expect(page.locator("#password")).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Login", exact: true }),
    ).toBeVisible();
  });

  test("sign out clears authenticated state", async ({ context, page }) => {
    await context.addCookies([
      {
        domain: "localhost",
        name: "e2e-test-auth",
        path: "/",
        value: "bypass",
      },
    ]);

    await page.goto("/", { timeout: 30000, waitUntil: "load" });

    await expect(page.getByRole("button", { name: "Sign Out" })).toBeVisible({
      timeout: 15000,
    });

    await context.clearCookies();

    await page.goto("/", { timeout: 30000, waitUntil: "load" });

    await expect(visibleHeaderLink(page, "Login")).toBeVisible({
      timeout: 15000,
    });
    await expect(
      page.getByRole("button", { name: "Sign Out" }),
    ).not.toBeVisible();
  });

  test("authenticated user sees account links", async ({ context, page }) => {
    await context.addCookies([
      {
        domain: "localhost",
        name: "e2e-test-auth",
        path: "/",
        value: "bypass",
      },
    ]);

    await page.goto("/", { timeout: 30000, waitUntil: "load" });

    await expect(page.getByRole("button", { name: "Sign Out" })).toBeVisible({
      timeout: 15000,
    });
    await expect(visibleHeaderLink(page, "Account")).toBeVisible();
    await expect(visibleHeaderLink(page, "Login")).not.toBeVisible();
  });

  test("upload page redirects to login when not authenticated", async ({
    page,
  }) => {
    await page.goto("/upload", { timeout: 30000, waitUntil: "load" });

    await expect(page).toHaveURL(/\/login/, { timeout: 10000 });
  });
});
