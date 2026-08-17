import { expect, test, type Page } from "@playwright/test";

type ToastOptions = {
  action?: { label: string; onClick: () => void };
  description?: string;
  duration?: number;
  title: string;
  type?: "success" | "error";
};

type ToastBox = {
  height: number;
  id: string;
  width: number;
  x: number;
  y: number;
};

// Regression test: Ark/Zag collapses toasts into an overlapping stack when the
// toaster is created with `overlap: true` (see src/components/ui/toaster.tsx).
// Zag positions each toast with runtime CSS variables (--x, --y, --scale,
// --height, --opacity): older toasts translate up by `gap` and scale down, so
// every toast peeks out from behind the frontmost one. If the rules in
// src/styles/app.css that map those variables onto translate/scale/height/
// opacity were removed, all toasts would pile up at the exact same spot
// instead of showing the overlapping stack.
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
      return {
        height: rect.height,
        id: element.id,
        width: rect.width,
        x: rect.x,
        y: rect.y,
      };
    }),
  );
}

function expectOverlap(boxes: ToastBox[]) {
  expect(
    boxes.length,
    "expected at least two open toasts to check for overlap",
  ).toBeGreaterThanOrEqual(2);

  // Every toast must share screen space with every other toast (horizontal and
  // vertical overlap), while still having its own spot so the stack peeks
  // instead of piling all toasts at the exact same pixel.
  const origins = new Set(boxes.map((box) => `${box.x},${box.y}`));
  expect(
    origins.size,
    "toasts must be offset from each other (peek stack), not all at the same spot",
  ).toBe(boxes.length);

  for (let i = 0; i < boxes.length; i++) {
    for (let j = i + 1; j < boxes.length; j++) {
      const a = boxes[i];
      const b = boxes[j];
      if (!a || !b) continue;
      const overlapX =
        Math.min(a.x + a.width, b.x + b.width) - Math.max(a.x, b.x);
      const overlapY =
        Math.min(a.y + a.height, b.y + b.height) - Math.max(a.y, b.y);
      expect(
        overlapX > 0 && overlapY > 0,
        `toasts "${a.id}" and "${b.id}" do not overlap (overlapX ${overlapX}px, overlapY ${overlapY}px)`,
      ).toBe(true);
    }
  }
}

test.describe("Toast", () => {
  test("toasts overlap in a peek stack on desktop", async ({ page }) => {
    await page.goto("/", { timeout: 30000, waitUntil: "load" });

    await fireStackedToasts(page);
    expectOverlap(await openToastBoxes(page));
  });

  test("toasts overlap in a peek stack on mobile", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/", { timeout: 30000, waitUntil: "load" });

    await fireStackedToasts(page);
    expectOverlap(await openToastBoxes(page));
  });
});
