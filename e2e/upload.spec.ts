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
    // The page is server-rendered; React hydration happens ~1s later and resets
    // any input made before it. Wait for the app to finish loading so fills and
    // file selection are not discarded.
    await page.waitForLoadState("networkidle");
  });

  test("page loads with upload form", async ({ page }) => {
    await expect(page.locator("form")).toBeVisible();
    await expect(page.getByLabel("Video *")).toBeVisible();
    await expect(page.getByRole("button", { name: "Upload" })).toBeVisible();
  });

  test("related post search does not emit a controlled-input warning", async ({
    page,
  }) => {
    const controlledInputWarnings: string[] = [];
    page.on("console", (message) => {
      if (
        message.type() === "error" &&
        message.text().includes("both value and defaultValue")
      ) {
        controlledInputWarnings.push(message.text());
      }
    });

    await page.goto("/upload", { timeout: 30000, waitUntil: "load" });
    await page.waitForLoadState("networkidle");
    await expect(
      page.getByPlaceholder("Search by title or enter post ID..."),
    ).toBeVisible();

    expect(controlledInputWarnings).toEqual([]);
  });

  test("uploading a video shows preview and thumbnail selector", async ({
    page,
  }) => {
    const mediaErrors: string[] = [];
    page.on("pageerror", (error) => {
      if (error.message.includes("querySelector")) {
        mediaErrors.push(error.message);
      }
    });

    await page.locator("#title").fill("Test Video");
    await page.locator("#description").fill("A test video description");

    const fileChooserPromise = page.waitForEvent("filechooser", {
      timeout: 10000,
    });
    // SAFETY: the input[type="file"] locator always matches an HTMLInputElement,
    // so asserting el enables .click() without optional chaining.
    await page
      .locator('input[type="file"]')
      .evaluate((el) => (el as HTMLInputElement).click());
    const fileChooser = await fileChooserPromise;
    await fileChooser.setFiles(TEST_VIDEO);

    await page.waitForTimeout(3000);

    await page.evaluate(() => {
      // SAFETY: the querySelector targets the only input[type="file"] on the
      // page, which is always an HTMLInputElement.
      const input = document.querySelector(
        'input[type="file"]',
      ) as HTMLInputElement;
      if (input?.files?.length) {
        input.dispatchEvent(
          new InputEvent("input", { bubbles: true, composed: true }),
        );
      }
    });

    const mediaController = page.locator("media-controller");
    await expect(mediaController).toBeVisible({
      timeout: 20000,
    });
    const fullscreenTargetIsPlayer = await mediaController.evaluate(
      (element) => {
        // SAFETY: media-controller exposes fullscreenElement as a Media Chrome
        // custom-element property; the parent is the wrapper rendered by Video.
        const controller = element as HTMLElement & {
          fullscreenElement?: HTMLElement;
        };
        return controller.fullscreenElement === element.parentElement;
      },
    );
    expect(fullscreenTargetIsPlayer).toBe(true);
    expect(mediaErrors).toEqual([]);

    await expect(page.getByText("Select Thumbnail")).toBeVisible({
      timeout: 15000,
    });

    // The selected thumbnail must be exposed via aria-pressed so selection
    // feedback is asserted (regression guard: dynamic border classes were
    // once missing from the generated CSS, leaving no visible selection).
    const firstThumbnail = page.getByRole("button", { name: "Thumbnail 1" });
    await expect(firstThumbnail).toHaveAttribute("aria-pressed", "true", {
      timeout: 5000,
    });
    await page.getByRole("button", { name: "Thumbnail 2" }).click();
    await expect(
      page.getByRole("button", { name: "Thumbnail 2" }),
    ).toHaveAttribute("aria-pressed", "true");
    await expect(firstThumbnail).toHaveAttribute("aria-pressed", "false");

    await expect(page.getByRole("button", { name: "Upload" })).not.toBeDisabled(
      { timeout: 5000 },
    );
  });

  test("video preview is cleared when file is removed", async ({ page }) => {
    const fileChooserPromise = page.waitForEvent("filechooser", {
      timeout: 10000,
    });
    // SAFETY: the input[type="file"] locator always matches an HTMLInputElement,
    // so asserting el enables .click() without optional chaining.
    await page
      .locator('input[type="file"]')
      .evaluate((el) => (el as HTMLInputElement).click());
    const fileChooser = await fileChooserPromise;
    await fileChooser.setFiles(TEST_VIDEO);

    await page.waitForTimeout(3000);

    await page.evaluate(() => {
      // SAFETY: the querySelector targets the only input[type="file"] on the
      // page, which is always an HTMLInputElement.
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

    await page.getByRole("button", { name: /^Remove / }).click();

    await expect(page.locator("media-controller")).not.toBeVisible({
      timeout: 5000,
    });

    await expect(page.locator('[data-part="dropzone"]')).toBeVisible({
      timeout: 5000,
    });
  });
});
