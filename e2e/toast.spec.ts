import { expect, test, type Page } from "@playwright/test";

type ToastOptions = {
  action?: { label: string; onClick: () => void };
  description?: string;
  duration?: number;
  title: string;
  type?: "success" | "error";
};

// Regression test: Ark/Zag positions each toast with runtime CSS variables
// (--x, --y, --scale, --height, --opacity). If the rules in src/styles/app.css
// that map them onto `translate`/`scale`/`height`/`opacity` are removed, all
// toasts render at the same spot and overlap instead of stacking.
async function fireStackedToasts(page: Page) {
  await expect(
    page.locator('[data-scope="toast"][data-part="group"]'),
  ).toHaveCount(1, { timeout: 15000 });

  await page.evaluate(async () => {
    // Vite dev serves source modules at their .tsx URL; the import specifier is
    // built dynamically so the type-checker does not flag the extension.
    const toasterUrl = ["/src/components/ui/toaster", ".tsx"].join("");
    const { toaster } = (await import(toasterUrl)) as {
      toaster: { create: (options: ToastOptions) => void };
    };
    // Mixed heights: title only, title + long description, title + description
    // + action. Long durations keep the toasts open for the whole assertion.
    toaster.create({
      duration: 10000,
      title: "Changes saved",
      type: "success",
    });
    toaster.create({
      description:
        "Your profile has been updated successfully. This description is deliberately long so the toast wraps over multiple lines and gets taller.",
      duration: 10000,
      title: "Profile updated",
      type: "success",
    });
    toaster.create({
      action: { label: "Retry", onClick: () => undefined },
      description: "There was an error uploading your file. Please try again.",
      duration: 10000,
      title: "Upload failed",
      type: "error",
    });
    // Wait for the entrance transitions (400ms) to settle before measuring.
    await new Promise((resolve) => setTimeout(resolve, 800));
  });

  await expect(
    page.locator('[data-scope="toast"][data-part="root"][data-state="open"]'),
  ).toHaveCount(3, { timeout: 10000 });
}

function openToastBoxes(page: Page) {
  return page.evaluate(() =>
    Array.from(
      document.querySelectorAll(
        '[data-scope="toast"][data-part="root"][data-state="open"]',
      ),
    ).map((element) => {
      const rect = element.getBoundingClientRect();
      return { id: element.id, y: rect.y, height: rect.height };
    }),
  );
}

function expectNoOverlap(
  boxes: Array<{ id: string; y: number; height: number }>,
) {
  const sorted = [...boxes].sort((a, b) => a.y - b.y);
  for (let i = 1; i < sorted.length; i++) {
    const previous = sorted[i - 1];
    const current = sorted[i];
    if (!previous || !current) continue;
    const gap = current.y - (previous.y + previous.height);
    expect(
      gap,
      `toasts "${previous.id}" and "${current.id}" overlap (vertical gap ${gap}px)`,
    ).toBeGreaterThanOrEqual(0);
  }
}

test.describe("Toast", () => {
  test("toasts stack without overlapping on desktop", async ({ page }) => {
    await page.goto("/", { timeout: 30000, waitUntil: "load" });

    await fireStackedToasts(page);
    expectNoOverlap(await openToastBoxes(page));
  });

  test("toasts stack without overlapping on mobile", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/", { timeout: 30000, waitUntil: "load" });

    await fireStackedToasts(page);
    expectNoOverlap(await openToastBoxes(page));
  });
});
