import { expect, test } from "@playwright/test";

const TEST_VIDEO = "e2e/test.mp4";

test.describe("Convert page", () => {
  test.beforeEach(async ({ context, page }) => {
    await context.addCookies([
      {
        domain: "localhost",
        name: "e2e-test-auth",
        path: "/",
        value: "bypass",
      },
    ]);
    await page.goto("/convert", { timeout: 30000, waitUntil: "load" });
    await expect(
      page.getByRole("heading", { name: "Video/Audio Converter" }),
    ).toBeVisible({ timeout: 15000 });
  });

  test("page loads with converter form", async ({ page }) => {
    await expect(
      page.getByText("Drag and drop files here"),
    ).toBeVisible();
    await expect(
      page.getByRole("combobox", { name: "Output Format" }),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Convert" }),
    ).toBeVisible();
  });

  test("convert button is disabled without file and format", async ({
    page,
  }) => {
    await expect(
      page.getByRole("button", { name: "Convert" }),
    ).toBeDisabled();
  });

  test("output format select opens and shows options", async ({ page }) => {
    await page.getByRole("combobox", { name: "Output Format" }).click();

    await expect(
      page.getByRole("option", { name: /MP4.*Transcode/ }),
    ).toBeVisible({ timeout: 5000 });
    await expect(
      page.getByRole("option", { name: /WebM.*Transcode/ }),
    ).toBeVisible();
    await expect(
      page.getByRole("option", { name: /MKV.*Passthrough/ }),
    ).toBeVisible();
  });

  test("file upload shows filename in list", async ({ page }) => {
    await page.locator('input[type="file"]').setInputFiles(TEST_VIDEO);

    await expect(page.getByText("test.mp4")).toBeVisible({ timeout: 10000 });
  });

  test("convert button stays disabled after file selection without format", async ({
    page,
  }) => {
    await page.locator('input[type="file"]').setInputFiles(TEST_VIDEO);

    await expect(page.getByText("test.mp4")).toBeVisible({ timeout: 10000 });

    await expect(
      page.getByRole("button", { name: "Convert" }),
    ).toBeDisabled({ timeout: 5000 });
  });

  test("shows converter description text at bottom", async ({ page }) => {
    await expect(
      page.getByText(
        /Supported input: mp4, mov, m4a, mkv, webm, avi, ts, wav, mp3, flac, aac, m3u8/,
      ),
    ).toBeVisible();
    await expect(
      page.getByText(
        /Transcode: MP4 \(H\.264\/AAC\), WebM \(VP9\/Opus\)/,
      ),
    ).toBeVisible();
  });
});
