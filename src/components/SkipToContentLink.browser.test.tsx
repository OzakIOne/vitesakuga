import { expect, test } from "vitest";
import { render } from "vitest-browser-react";
import { page } from "vitest/browser";

import { SkipToContentLink } from "./SkipToContentLink";

test("focuses the current page main content when activated", async () => {
  const main = document.createElement("main");
  main.id = "main-content";
  main.tabIndex = -1;
  document.body.appendChild(main);

  await render(<SkipToContentLink />);

  const link = page.getByRole("link", { name: "Skip to content" });
  await expect.element(link).toHaveAttribute("href", "#main-content");

  await link.click();

  expect(document.activeElement).toBe(main);
});
