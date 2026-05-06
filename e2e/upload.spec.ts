import { expect, test } from "@playwright/test";

const TEST_VIDEO = "e2e/test.mp4";

test.describe("Upload page", () => {
  test.beforeEach(async ({ context, page }) => {
    await context.addCookies([
      {
        domain: "localhost",
        name: "e2e-test-auth",
        path: "/",
        value: "bypass",
      },
    ]);
    await page.goto("/upload", { timeout: 30000, waitUntil: "load" });
    await expect(page.getByRole("button", { name: "Upload" })).toBeVisible({
      timeout: 15000,
    });
  });

  test("page loads with upload form", async ({ page }) => {
    await expect(page.locator("form")).toBeVisible();
    await expect(page.getByLabel("Video *")).toBeVisible();
    await expect(page.getByRole("button", { name: "Upload" })).toBeVisible();
  });

  test("uploading a video shows preview and thumbnail selector", async ({
    page,
  }) => {
    const fileChooserPromise = page.waitForEvent("filechooser", {
      timeout: 10000,
    });
    await page
      .locator('input[type="file"]')
      .evaluate((el) => (el as HTMLInputElement).click());
    const fileChooser = await fileChooserPromise;
    await fileChooser.setFiles(TEST_VIDEO);

    await page.waitForTimeout(3000);

    await page.evaluate(() => {
      const input = document.querySelector(
        'input[type="file"]',
      ) as HTMLInputElement;
      if (input?.files?.length) {
        input.dispatchEvent(
          new InputEvent("input", { bubbles: true, composed: true }),
        );
      }
    });

    await expect(page.locator("media-controller")).toBeVisible({
      timeout: 20000,
    });

    await expect(page.getByText("Select Thumbnail")).toBeVisible({
      timeout: 15000,
    });

    await expect(page.getByRole("button", { name: "Upload" })).not.toBeDisabled(
      { timeout: 5000 },
    );
  });

  test("video preview is cleared when file is removed", async ({ page }) => {
    const fileChooserPromise = page.waitForEvent("filechooser", {
      timeout: 10000,
    });
    await page
      .locator('input[type="file"]')
      .evaluate((el) => (el as HTMLInputElement).click());
    const fileChooser = await fileChooserPromise;
    await fileChooser.setFiles(TEST_VIDEO);

    await page.waitForTimeout(3000);

    await page.evaluate(() => {
      const input = document.querySelector(
        'input[type="file"]',
      ) as HTMLInputElement;
      if (input?.files?.length) {
        input.dispatchEvent(
          new InputEvent("input", { bubbles: true, composed: true }),
        );
      }
    });

    await expect(page.locator("media-controller")).toBeVisible({
      timeout: 20000,
    });

    await page.getByRole("button", { name: /delete file/i }).click();

    await expect(page.locator("media-controller")).not.toBeVisible({
      timeout: 5000,
    });

    await expect(page.locator('[data-part="dropzone"]')).toBeVisible({
      timeout: 5000,
    });
  });
});
