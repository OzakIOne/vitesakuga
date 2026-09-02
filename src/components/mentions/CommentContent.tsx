import { Link } from "@tanstack/react-router";
import { Fragment, useMemo } from "react";
import { Text } from "src/components/ui/typography";
import { splitContentByMentions } from "src/lib/mentions/mentions";

type CommentMention = {
  readonly userId: string;
  readonly username: string;
};

/**
 * Renders sanitized plain-text comment content, turning `@handle` tokens
 * that match a resolved mention into profile links. Unresolved handles
 * (user renamed, deleted account, plain text) render as literal text.
 */
export function CommentContent({
  content,
  mentions,
}: {
  content: string;
  mentions: readonly CommentMention[];
}) {
  const tokens = useMemo(() => splitContentByMentions(content), [content]);
  const userIdByHandle = useMemo(
    () =>
      new Map(mentions.map((mention) => [mention.username, mention.userId])),
    [mentions],
  );

  return (
    <Text className="break-words" mt={2}>
      {tokens.map((token, index) =>
        token.kind === "text" ? (
          <Fragment key={index}>{token.text}</Fragment>
        ) : userIdByHandle.has(token.handle) ? (
          <Link
            className="font-medium text-blue-600 hover:underline dark:text-blue-400"
            key={index}
            params={{ id: userIdByHandle.get(token.handle) ?? "" }}
            to="/users/$id"
          >
            @{token.handle}
          </Link>
        ) : (
          <Fragment key={index}>@{token.handle}</Fragment>
        ),
      )}
    </Text>
  );
}
