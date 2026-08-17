import { expect, test } from "@playwright/test";

// Regression test: React 19's client renderer logs
// "Cannot render a sync or defer <script> outside the main document..." when a
// non-async inline <script> is hydrated outside the document root. The
// next-themes ThemeProvider (src/components/ui/provider.tsx) renders an inline
// anti-FOUC theme script, so it must be rendered inside <body> (inside
// RootDocument), not as a sibling above <html>.
test("theme provider script does not trigger the React sync script hydration error", async ({
  page,
}) => {
  const scriptErrors: string[] = [];
  page.on("console", (msg) => {
    if (
      msg.type() === "error" &&
      msg.text().includes("Cannot render a sync or defer <script>")
    ) {
      scriptErrors.push(msg.text());
    }
  });

  await page.goto("/");

  await expect(page.locator("body")).toBeAttached();
  await expect
    .poll(() => page.evaluate(() => document.querySelectorAll("script").length))
    .toBeGreaterThan(0);

  expect(scriptErrors).toEqual([]);
});
