import { Link } from "@tanstack/react-router";
import { Fragment, useMemo } from "react";
import { Text } from "src/components/ui/typography";
import {
  splitContentByMentions,
  splitContentByStoredMentions,
} from "src/lib/mentions/mentions";

type CommentMention = {
  readonly userId: string;
  readonly username: string;
};

type Segment =
  | { readonly kind: "text"; readonly text: string }
  | {
      readonly kind: "mention";
      readonly userId: string;
      readonly label: string;
    };

/**
 * Splits stored comment content into renderable segments. Stored tokens
 * (`[@handle](user:id)`) resolve their label from the current username;
 * plain `@handle` text (legacy comments, unresolved handles) matches by
 * handle. Everything else stays literal text.
 */
function toSegments(
  content: string,
  usernameByUserId: ReadonlyMap<string, string>,
  userIdByHandle: ReadonlyMap<string, string>,
): Segment[] {
  const segments: Segment[] = [];
  const pushText = (text: string) => {
    for (const token of splitContentByMentions(text)) {
      if (token.kind === "text") {
        segments.push({ kind: "text", text: token.text });
        continue;
      }
      const userId = userIdByHandle.get(token.handle);
      segments.push(
        userId === undefined
          ? { kind: "text", text: `@${token.handle}` }
          : { kind: "mention", userId, label: token.handle },
      );
    }
  };

  for (const stored of splitContentByStoredMentions(content)) {
    if (stored.kind === "text") {
      pushText(stored.text);
      continue;
    }
    const username = usernameByUserId.get(stored.userId);
    segments.push({
      kind: "mention",
      userId: stored.userId,
      label: username ?? stored.handle,
    });
  }
  return segments;
}

/**
 * Renders stored comment content, turning mention tokens (and legacy plain
 * `@handle` text) into profile links labeled with the user's *current*
 * username — a rename is reflected without touching stored content.
 */
export function CommentContent({
  content,
  mentions,
}: {
  content: string;
  mentions: readonly CommentMention[];
}) {
  const usernameByUserId = useMemo(
    () =>
      new Map(mentions.map((mention) => [mention.userId, mention.username])),
    [mentions],
  );
  const userIdByHandle = useMemo(
    () =>
      new Map(mentions.map((mention) => [mention.username, mention.userId])),
    [mentions],
  );
  const segments = useMemo(
    () => toSegments(content, usernameByUserId, userIdByHandle),
    [content, usernameByUserId, userIdByHandle],
  );

  return (
    <Text className="break-words" mt={2}>
      {segments.map((segment, index) =>
        segment.kind === "text" ? (
          <Fragment key={index}>{segment.text}</Fragment>
        ) : (
          <Link
            className="font-medium text-blue-600 hover:underline dark:text-blue-400"
            key={index}
            params={{ id: segment.userId }}
            to="/users/$id"
          >
            @{segment.label}
          </Link>
        ),
      )}
    </Text>
  );
}
