import { Markdown } from "@tanstack/markdown/react";

type MarkdownContentProps = {
  children: string;
  className?: string;
};

/**
 * Shared renderer for repository-authored Markdown content.
 *
 * TanStack Markdown keeps raw HTML disabled by default, so repository-authored
 * content cannot introduce HTML through this renderer.
 */
export function MarkdownContent({ children, className }: MarkdownContentProps) {
  return (
    <div
      className={className ? `markdown-prose ${className}` : "markdown-prose"}
    >
      <Markdown>{children}</Markdown>
    </div>
  );
}
