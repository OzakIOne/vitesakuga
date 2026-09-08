// @vitest-environment happy-dom
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { SkipToContentLink } from "./SkipToContentLink";

describe(SkipToContentLink, () => {
  it("focuses the current page main content when activated", () => {
    const main = document.createElement("main");
    main.id = "main-content";
    main.tabIndex = -1;
    document.body.append(main);

    render(<SkipToContentLink />);

    const link = screen.getByRole("link", { name: "Skip to content" });
    expect(link.getAttribute("href")).toBe("#main-content");

    fireEvent.click(link);

    expect(document.activeElement).toBe(main);
  });
});
