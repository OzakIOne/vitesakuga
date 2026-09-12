import type { InlineNode, MarkdownExtension } from "@tanstack/markdown";

import { replaceMentionTokens, splitContentByMentions } from "./mentions";

/**
 * Mention links use an ordinary internal URL because TanStack Markdown's
 * default URL policy intentionally removes unknown protocols such as the
 * stored `user:` token protocol.
 */
export const mentionHref = (userId: string): string =>
  `/users/${encodeURIComponent(userId)}`;

const escapeMarkdownLinkLabel = (label: string): string =>
  label.replaceAll("\\", "\\\\").replaceAll("[", "\\[").replaceAll("]", "\\]");

/**
 * Makes canonical mention tokens parseable Markdown while keeping the user id
 * in the generated URL. The label remains the current username when known,
 * and falls back to the handle captured when the mention was written.
 */
export function prepareMentionMarkdown(
  content: string,
  usernameByUserId: ReadonlyMap<string, string>,
): string {
  return replaceMentionTokens(content, (token) => {
    const username = escapeMarkdownLinkLabel(
      usernameByUserId.get(token.userId) ?? token.handle,
    );
    return `[@${username}](${mentionHref(token.userId)})`;
  });
}

function transformMentionNode(
  node: InlineNode,
  userIdByHandle: ReadonlyMap<string, string>,
): InlineNode[] {
  if (node.type === "text") {
    return splitContentByMentions(node.value).map((token) => {
      if (token.kind === "text") {
        return { type: "text", value: token.text };
      }

      const userId = userIdByHandle.get(token.handle);
      return userId === undefined
        ? { type: "text", value: `@${token.handle}` }
        : {
            type: "link",
            href: mentionHref(userId),
            children: [{ type: "text", value: `@${token.handle}` }],
          };
    });
  }

  if (
    node.type === "strong" ||
    node.type === "emphasis" ||
    node.type === "strike"
  ) {
    return [
      {
        ...node,
        children: node.children.flatMap((child) =>
          transformMentionNode(child, userIdByHandle),
        ),
      },
    ];
  }

  // Do not reinterpret code spans or link labels. Canonical stored mentions
  // are already links before parsing and therefore remain resolvable inside
  // emphasis, blockquotes, and other Markdown containers.
  return [node];
}

/**
 * Resolves legacy plain `@handle` text after Markdown parsing. This keeps
 * mentions out of code spans and ordinary link labels while preserving the
 * existing rename-proof stored-token behavior.
 */
export function createMentionMarkdownExtension(
  userIdByHandle: ReadonlyMap<string, string>,
): MarkdownExtension {
  const normalizedUserIdByHandle = new Map(
    [...userIdByHandle].map(([handle, userId]) => [
      handle.toLowerCase(),
      userId,
    ]),
  );

  return {
    name: "vitesakuga-mentions",
    transformInline: (nodes) =>
      nodes.flatMap((node) =>
        transformMentionNode(node, normalizedUserIdByHandle),
      ),
  };
}
