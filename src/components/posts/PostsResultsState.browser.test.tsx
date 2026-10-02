import { describe, expect, test, vi } from "vitest";
import { render } from "vitest-browser-react";
import { page } from "vitest/browser";

import { PostsResultsState } from "./PostsResultsState";

const renderResultsState = async (
  overrides: Partial<React.ComponentProps<typeof PostsResultsState>> = {},
) => {
  const props: React.ComponentProps<typeof PostsResultsState> = {
    activeFilters: ["Search: zzzauditnomatch"],
    children: <div>Posts grid</div>,
    error: null,
    hasLoadedPosts: false,
    isPending: false,
    onClearFilters: vi.fn(),
    onRetry: vi.fn(),
    resultCount: 0,
    ...overrides,
  };
  return render(<PostsResultsState {...props} />);
};

describe(PostsResultsState, () => {
  test("B4: explains an empty result and offers to clear filters", async () => {
    const onClearFilters = vi.fn();
    await renderResultsState({ onClearFilters });

    await expect
      .element(page.getByRole("heading", { name: "No posts found" }))
      .toBeVisible();
    await expect.element(page.getByText("0 results")).toBeVisible();
    await expect
      .element(page.getByText("Search: zzzauditnomatch"))
      .toBeVisible();

    await page.getByRole("button", { name: "Clear filters" }).click();

    expect(onClearFilters).toHaveBeenCalledTimes(1);
  });

  test("B4: distinguishes initial loading from an empty result", async () => {
    await renderResultsState({ activeFilters: [], isPending: true });

    await expect.element(page.getByText("Loading posts...")).toBeVisible();
    await expect
      .element(page.getByRole("heading", { name: "No posts found" }))
      .not.toBeInTheDocument();
  });

  test("B4: shows a retry action for a failed initial request", async () => {
    const onRetry = vi.fn();
    await renderResultsState({
      error: new Error("network unavailable"),
      onRetry,
    });

    await expect
      .element(page.getByRole("heading", { name: "Could not load posts" }))
      .toBeVisible();

    await page.getByRole("button", { name: "Retry" }).click();

    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  test("shows the result count and active filters with loaded posts", async () => {
    await renderResultsState({
      children: <div>Posts grid</div>,
      hasLoadedPosts: true,
      resultCount: 42,
    });

    await expect.element(page.getByText("42 results")).toBeVisible();
    await expect.element(page.getByText("Posts grid")).toBeVisible();
  });
});
