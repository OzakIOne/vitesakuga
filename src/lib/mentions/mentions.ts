/**
 * @mention parsing for comments, safe to import from client and server code.
 *
 * A mention is `@username` where `username` is a user handle (`username`
 * column on `user`, normalized to lowercase `[a-z0-9_]`, 3–30 chars — see the
 * Better Auth username plugin config in `src/lib/auth/index.ts`). Content
 * stays plain text: the handle is the mention's identity on the wire, while
 * the `comment_mentions` table resolves it to user ids server-side.
 */

/** Username rules shared by Better Auth's username plugin and mention parsing. */
export const USERNAME_MIN_LENGTH = 3;
export const USERNAME_MAX_LENGTH = 30;
export const USERNAME_PATTERN = /^[a-z0-9_]{3,30}$/;

/**
 * `@handle` preceded by a non-username character (or the start of the
 * content), so `mail@john` (emails) and `@jane` inside `@jane_doe` do not
 * match. Matched case-insensitively (`@Jane` mentions the handle `jane`);
 * extracted handles are always lowercased. Lookbehind is fine here: it only
 * runs on modern browsers and Node.
 */
const MENTION_REGEX = /(?<![a-z0-9_])@([a-z0-9_]{3,30})(?![a-z0-9_])/gi;

/** Unique lowercase handles mentioned in `content`, in order of appearance. */
export function extractMentionHandles(content: string): string[] {
  const handles: string[] = [];
  for (const match of content.matchAll(MENTION_REGEX)) {
    const raw = match[1];
    if (raw === undefined) {
      continue;
    }
    const handle = raw.toLowerCase();
    if (!handles.includes(handle)) {
      handles.push(handle);
    }
  }
  return handles;
}

export type MentionToken =
  | { readonly kind: "mention"; readonly handle: string }
  | { readonly kind: "text"; readonly text: string };

/**
 * Splits comment content into plain-text and mention tokens for rendering.
 * Text pieces are literal (no regex escaping needed by callers).
 */
export function splitContentByMentions(content: string): MentionToken[] {
  const tokens: MentionToken[] = [];
  let lastIndex = 0;
  for (const match of content.matchAll(MENTION_REGEX)) {
    const raw = match[1];
    const start = match.index;
    if (raw === undefined || start === undefined) {
      continue;
    }
    if (start > lastIndex) {
      tokens.push({ kind: "text", text: content.slice(lastIndex, start) });
    }
    tokens.push({ kind: "mention", handle: raw.toLowerCase() });
    lastIndex = start + match[0].length;
  }
  if (lastIndex < content.length) {
    tokens.push({ kind: "text", text: content.slice(lastIndex) });
  }
  return tokens;
}

/**
 * Slug a display name into a username candidate: lowercase
 * `[a-z0-9_]`, trimmed to 24 chars so a collision suffix always fits in 30.
 * Returns a padded handle when the name has no usable characters; callers
 * append a random suffix until the handle is unique.
 */
export function slugifyUsername(name: string): string {
  const slug = name
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9_]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .replace(/_{2,}/g, "_")
    .slice(0, 24)
    .replace(/^_+|_+$/g, "");
  if (slug.length >= USERNAME_MIN_LENGTH) {
    return slug;
  }
  // Short/empty names ("Jo", emoji-only): pad so the handle meets the
  // minimum length; the caller's uniqueness suffix distinguishes users.
  return `user_${slug}`;
}
