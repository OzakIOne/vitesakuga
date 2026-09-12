// @vitest-environment happy-dom
import { cleanup, render } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { CommentContent } from "./CommentContent";

vi.mock("@tanstack/react-router", () => ({
  Link: ({
    children,
    className,
    params,
  }: {
    children: ReactNode;
    className?: string;
    params: { id: string };
  }) => (
    <a className={className} href={`/users/${params.id}`}>
      {children}
    </a>
  ),
}));

const renderComment = (
  content: string,
  mentions: readonly { userId: string; username: string }[] = [],
) => render(<CommentContent content={content} mentions={mentions} />);

describe(CommentContent, () => {
  afterEach(cleanup);

  it("renders typed HTML payloads as text instead of DOM elements", () => {
    const payload = "<script>alert('xss')</script><img src=x onerror=alert(1)>";
    const { container } = renderComment(payload);

    expect(container.querySelector("script")).toBeNull();
    expect(container.querySelector("img")).toBeNull();
    expect(container.textContent).toContain(payload);
  });

  it("does not render unsafe or unknown-protocol links", () => {
    const { container } = renderComment(
      "[script](javascript:alert(1)) [html](data:text/html,payload) [user](user:attacker)",
    );

    expect(container.querySelectorAll("a")).toHaveLength(0);
    expect(container.textContent).toContain("script html user");
  });

  it("hardens external links and keeps profile mentions internal", () => {
    const { container } = renderComment(
      "[@old](user:user-1) [docs](https://example.com)",
      [{ userId: "user-1", username: "current" }],
    );

    const profileLink = container.querySelector('a[href="/users/user-1"]');
    expect(profileLink?.textContent).toBe("@current");

    const externalLink = container.querySelector(
      'a[href="https://example.com"]',
    );
    expect(externalLink).not.toBeNull();
    expect(externalLink?.getAttribute("target")).toBe("_blank");
    expect(externalLink?.getAttribute("rel")).toBe(
      "nofollow noopener noreferrer",
    );
  });

  it("does not let a hostile username escape its profile-link label", () => {
    const { container } = renderComment("[@old](user:user-1)", [
      { userId: "user-1", username: "evil](javascript:alert(1)" },
    ]);

    expect(container.querySelector('a[href^="javascript:"]')).toBeNull();
    expect(
      container.querySelector('a[href="/users/user-1"]')?.textContent,
    ).toBe("@evil](javascript:alert(1)");
  });

  it("suppresses Markdown images so comments cannot create tracking requests", () => {
    const { container } = renderComment(
      "![tracking pixel](https://evil.example/pixel.gif)",
    );

    expect(container.querySelector("img")).toBeNull();
  });
});
