// @vitest-environment happy-dom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { PostsResultsState } from "./PostsResultsState";

const renderResultsState = (
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
  afterEach(() => {
    cleanup();
  });

  it("explains an empty result and offers to clear filters", () => {
    const onClearFilters = vi.fn();
    renderResultsState({ onClearFilters });

    expect(screen.getByRole("heading", { name: "No posts found" })).toBeDefined();
    expect(screen.getByText("0 results")).toBeDefined();
    expect(screen.getByText("Search: zzzauditnomatch")).toBeDefined();

    fireEvent.click(screen.getByRole("button", { name: "Clear filters" }));

    expect(onClearFilters).toHaveBeenCalledTimes(1);
  });

  it("distinguishes initial loading from an empty result", () => {
    renderResultsState({ activeFilters: [], isPending: true });

    expect(screen.getByText("Loading posts...")).toBeDefined();
    expect(screen.queryByRole("heading", { name: "No posts found" })).toBeNull();
  });

  it("shows a retry action for a failed initial request", () => {
    const onRetry = vi.fn();
    renderResultsState({ error: new Error("network unavailable"), onRetry });

    expect(
      screen.getByRole("heading", { name: "Could not load posts" }),
    ).toBeDefined();

    fireEvent.click(screen.getByRole("button", { name: "Retry" }));

    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it("shows the result count and active filters with loaded posts", () => {
    renderResultsState({
      children: <div>Posts grid</div>,
      hasLoadedPosts: true,
      resultCount: 42,
    });

    expect(screen.getByText("42 results")).toBeDefined();
    expect(screen.getByText("Posts grid")).toBeDefined();
  });
});
