import { expect, test } from "@playwright/test";

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

    await expect(page.getByText("Sign Out")).toBeVisible({ timeout: 15000 });

    await context.clearCookies();

    await page.goto("/", { timeout: 30000, waitUntil: "load" });

    await expect(page.getByRole("link", { name: "Login" })).toBeVisible({
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

    await expect(page.getByText("Sign Out")).toBeVisible({ timeout: 15000 });
    await expect(page.getByRole("link", { name: "Account" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Login" })).not.toBeVisible();
  });

  test("upload page redirects to login when not authenticated", async ({
    page,
  }) => {
    await page.goto("/upload", { timeout: 30000, waitUntil: "load" });

    await expect(page).toHaveURL(/\/login/, { timeout: 10000 });
  });
});
