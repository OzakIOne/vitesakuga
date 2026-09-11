// @vitest-environment happy-dom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { EmptyState } from "./EmptyState";

afterEach(() => {
  cleanup();
});

describe(EmptyState, () => {
  it("renders a labelled empty state with optional guidance and action", () => {
    render(
      <EmptyState
        action={<button type="button">Clear filters</button>}
        description="Try changing your search."
        title="No posts found"
      />,
    );

    expect(
      screen.getByRole("heading", { name: "No posts found" }),
    ).toBeDefined();
    expect(screen.getByText("Try changing your search.")).toBeDefined();
    expect(screen.getByRole("button", { name: "Clear filters" })).toBeDefined();
  });

  it("supports compact nested states without introducing another heading", () => {
    render(
      <EmptyState
        description="Add posts to see them here."
        size="compact"
        title="No posts"
        titleAs="p"
      />,
    );

    expect(screen.queryByRole("heading")).toBeNull();
    expect(screen.getByText("No posts")).toBeDefined();
  });
});
