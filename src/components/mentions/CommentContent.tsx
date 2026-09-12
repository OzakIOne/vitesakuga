import { Markdown } from "@tanstack/markdown/react";
import { Link } from "@tanstack/react-router";
import type { ComponentPropsWithoutRef } from "react";
import { useMemo } from "react";
import {
  createMentionMarkdownExtension,
  prepareMentionMarkdown,
} from "src/lib/mentions/markdown";
import { splitContentByStoredMentions } from "src/lib/mentions/mentions";

type CommentMention = {
  readonly userId: string;
  readonly username: string;
};

type CommentAnchorProps = ComponentPropsWithoutRef<"a">;

const USER_PROFILE_HREF_REGEX = /^\/users\/([^/?#]+)$/;

const decodeProfileId = (encodedId: string): string | undefined => {
  try {
    return decodeURIComponent(encodedId);
  } catch {
    return undefined;
  }
};

function CommentMarkdownAnchor({
  children,
  href,
  ...props
}: CommentAnchorProps) {
  const profileMatch = href?.match(USER_PROFILE_HREF_REGEX);
  const profileId =
    profileMatch?.[1] === undefined
      ? undefined
      : decodeProfileId(profileMatch[1]);
  if (profileId !== undefined) {
    return (
      <Link
        className="font-medium text-blue-600 hover:underline dark:text-blue-400"
        params={{ id: profileId }}
        to="/users/$id"
      >
        {children}
      </Link>
    );
  }

  const isExternal = /^https?:\/\//i.test(href ?? "");
  return (
    <a
      {...props}
      href={href}
      rel={isExternal ? "nofollow noopener noreferrer" : props.rel}
      target={isExternal ? "_blank" : props.target}
    >
      {children}
    </a>
  );
}

function CommentMarkdownImage(): null {
  // Comments support text formatting and links, but not remote images. This
  // avoids turning user-generated comments into an external tracking surface.
  return null;
}

/**
 * Renders comment Markdown while preserving rename-proof profile mentions.
 * Raw HTML remains disabled and unsafe protocols are screened by TanStack
 * Markdown before the custom anchor component sees them.
 */
export function CommentContent({
  content,
  mentions,
}: {
  content: string;
  mentions: readonly CommentMention[];
}) {
  const mentionData = useMemo(() => {
    const usernameByUserId = new Map(
      mentions.map((mention) => [mention.userId, mention.username]),
    );
    const userIdByHandle = new Map(
      mentions.map((mention) => [
        mention.username.toLowerCase(),
        mention.userId,
      ]),
    );

    // A deleted or otherwise unavailable user can still have a stored token;
    // keep that token renderable using its captured handle and id.
    for (const segment of splitContentByStoredMentions(content)) {
      if (segment.kind === "token" && !usernameByUserId.has(segment.userId)) {
        usernameByUserId.set(segment.userId, segment.handle);
      }
    }

    return {
      extension: createMentionMarkdownExtension(userIdByHandle),
      source: prepareMentionMarkdown(content, usernameByUserId),
    };
  }, [content, mentions]);

  return (
    <div className="markdown-prose mt-2 whitespace-pre-wrap">
      <Markdown
        components={{
          a: CommentMarkdownAnchor,
          img: CommentMarkdownImage,
        }}
        extensions={[mentionData.extension]}
        headingIds={false}
      >
        {mentionData.source}
      </Markdown>
    </div>
  );
}
