import type { ReactNode } from "react";
import { describe, expect, test, vi } from "vitest";
import { render } from "vitest-browser-react";
import { page } from "vitest/browser";

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
  test("renders typed HTML payloads as text instead of DOM elements", async () => {
    const payload = "<script>alert('xss')</script><img src=x onerror=alert(1)>";
    await renderComment(payload);

    await expect.element(page.getByRole("img")).not.toBeInTheDocument();
    await expect
      .element(page.getByText(payload, { exact: true }))
      .toBeVisible();
  });

  test("does not render unsafe or unknown-protocol links", async () => {
    await renderComment(
      "[script](javascript:alert(1)) [html](data:text/html,payload) [user](user:attacker)",
    );

    await expect.element(page.getByRole("link")).not.toBeInTheDocument();
    await expect.element(page.getByText("script html user")).toBeVisible();
  });

  test("hardens external links and keeps profile mentions internal", async () => {
    await renderComment("[@old](user:user-1) [docs](https://example.com)", [
      { userId: "user-1", username: "current" },
    ]);

    const profileLink = page.getByRole("link", { name: "@current" });
    await expect.element(profileLink).toHaveAttribute("href", "/users/user-1");

    const externalLink = page.getByRole("link", { name: "docs" });
    await expect
      .element(externalLink)
      .toHaveAttribute("href", "https://example.com");
    await expect.element(externalLink).toHaveAttribute("target", "_blank");
    await expect
      .element(externalLink)
      .toHaveAttribute("rel", "nofollow noopener noreferrer");
  });

  test("does not let a hostile username escape its profile-link label", async () => {
    await renderComment("[@old](user:user-1)", [
      { userId: "user-1", username: "evil](javascript:alert(1)" },
    ]);

    await expect
      .element(page.getByRole("link", { name: "@evil](javascript:alert(1)" }))
      .toHaveAttribute("href", "/users/user-1");
    await expect
      .element(page.getByRole("link", { name: /^@evil/ }))
      .not.toHaveAttribute("href", /^javascript:/);
  });

  test("suppresses Markdown images so comments cannot create tracking requests", async () => {
    await renderComment("![tracking pixel](https://evil.example/pixel.gif)");

    await expect.element(page.getByRole("img")).not.toBeInTheDocument();
  });
});
