import { parseMarkdown } from "@tanstack/markdown/parser";
import { describe, expect, it } from "vitest";

import {
  createMentionMarkdownExtension,
  prepareMentionMarkdown,
} from "./markdown";

describe(prepareMentionMarkdown, () => {
  it("keeps the canonical user id in a safe internal link", () => {
    expect(
      prepareMentionMarkdown(
        "Hi [@old_name](user:user-1)!",
        new Map([["user-1", "current_name"]]),
      ),
    ).toBe("Hi [@current_name](/users/user-1)!");
  });

  it("falls back to the captured handle when the user is unavailable", () => {
    expect(
      prepareMentionMarkdown("Hi [@old_name](user:user-1)!", new Map()),
    ).toBe("Hi [@old_name](/users/user-1)!");
  });

  it("escapes a username before inserting it into a Markdown link label", () => {
    expect(
      prepareMentionMarkdown(
        "Hi [@old_name](user:user-1)!",
        new Map([["user-1", "evil](javascript:alert(1)"]]),
      ),
    ).toBe("Hi [@evil\\](javascript:alert(1)](/users/user-1)!");
  });
});

describe(createMentionMarkdownExtension, () => {
  it("turns legacy mentions into links but leaves code literal", () => {
    const document = parseMarkdown("Hello @jane, **@jane**, and `@jane`.", {
      extensions: [
        createMentionMarkdownExtension(new Map([["jane", "user-1"]])),
      ],
    });

    expect(document.children[0]).toMatchObject({
      children: [
        { type: "text", value: "Hello " },
        {
          type: "link",
          href: "/users/user-1",
          children: [{ type: "text", value: "@jane" }],
        },
        { type: "text", value: ", " },
        {
          type: "strong",
          children: [
            {
              type: "link",
              href: "/users/user-1",
              children: [{ type: "text", value: "@jane" }],
            },
          ],
        },
        { type: "text", value: ", and " },
        { type: "inlineCode", value: "@jane" },
        { type: "text", value: "." },
      ],
    });
  });

  it("does not preserve dangerous link protocols", () => {
    const document = parseMarkdown(
      "[run](javascript:alert(1)) [mention](user:user-1)",
      {
        extensions: [
          createMentionMarkdownExtension(new Map([["jane", "user-1"]])),
        ],
      },
    );

    expect(document.children[0]).toMatchObject({
      children: [{ type: "text", value: "run mention" }],
    });
  });
});
