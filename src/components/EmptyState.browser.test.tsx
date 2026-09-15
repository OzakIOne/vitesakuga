import { expect, test } from "vitest";
import { render } from "vitest-browser-react";
import { page } from "vitest/browser";

import { EmptyState } from "./EmptyState";

test("renders a labelled empty state with optional guidance and action", async () => {
  await render(
    <EmptyState
      action={<button type="button">Clear filters</button>}
      description="Try changing your search."
      title="No posts found"
    />,
  );

  await expect
    .element(page.getByRole("heading", { name: "No posts found" }))
    .toBeVisible();
  await expect
    .element(page.getByText("Try changing your search."))
    .toBeVisible();
  await expect
    .element(page.getByRole("button", { name: "Clear filters" }))
    .toBeVisible();
});

test("supports compact nested states without introducing another heading", async () => {
  await render(
    <EmptyState
      description="Add posts to see them here."
      size="compact"
      title="No posts"
      titleAs="p"
    />,
  );

  await expect.element(page.getByRole("heading")).not.toBeInTheDocument();
  await expect.element(page.getByText("No posts")).toBeVisible();
});
