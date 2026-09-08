import { expect, test } from "@playwright/test";

test.describe("Accessibility regressions", () => {
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

  test("B5: skip link stays on Help and focuses its main content", async ({
    page,
  }) => {
    await page.goto("/help", { waitUntil: "load" });

    const skipLink = page.getByRole("link", { name: "Skip to content" });
    await skipLink.focus();
    await page.keyboard.press("Enter");

    await expect(page).toHaveURL(/\/help#main-content$/);
    await expect(page.locator("main#main-content")).toBeFocused();
    await expect(
      page.getByRole("heading", { name: "Help", level: 1 }),
    ).toBeVisible();
  });

  test("B5: home and feed expose page-level headings", async ({ page }) => {
    await page.goto("/", { waitUntil: "load" });
    await expect(
      page.getByRole("heading", { name: "ViteSakuga", level: 1 }),
    ).toBeVisible();

    await page.goto("/posts", { waitUntil: "load" });
    await expect(
      page.getByRole("heading", { name: "Posts", level: 1 }),
    ).toBeVisible();
  });
});
