/**
 * @mention handling for comments, safe to import from client and server code.
 *
 * A typed mention is `@username` where `username` is a user handle
 * (`username` column on `user`, normalized to lowercase `[a-z0-9_]`, 3–30
 * chars — see the Better Auth username plugin config in
 * `src/lib/auth/index.ts`).
 *
 * Storage is id-based: the server canonicalizes comment content into
 * `[@handle](user:userId)` tokens before persisting (the handle is cosmetic,
 * the userId is the source of truth), so a username rename never breaks an
 * old comment. Rendering resolves the current username from the
 * `comment_mentions` join; editing re-hydrates tokens to `@handle` text and
 * the server re-canonicalizes on save.
 */

/** Username rules shared by Better Auth's username plugin and mention parsing. */
const USERNAME_MIN_LENGTH = 3;
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

// --- Stored (canonical) mention tokens -------------------------------------

/**
 * Canonical in-DB token for a resolved mention. The userId is the source of
 * truth (rename-proof); the handle is the one known at write time and is
 * only a fallback for display when the user row is gone.
 */
const MENTION_TOKEN_REGEX = /\[@([a-z0-9_]+)\]\(user:([A-Za-z0-9_-]{1,64})\)/g;

export type StoredMention = {
  readonly handle: string;
  readonly userId: string;
};

function buildMentionToken(handle: string, userId: string): string {
  return `[@${handle}](user:${userId})`;
}

/** Replace every stored token with `replacer(token)`'s return value. */
export function replaceMentionTokens(
  content: string,
  replacer: (token: StoredMention) => string,
): string {
  let result = "";
  let lastIndex = 0;
  for (const match of content.matchAll(MENTION_TOKEN_REGEX)) {
    const handle = match[1];
    const userId = match[2];
    const start = match.index;
    if (start === undefined || handle === undefined || userId === undefined) {
      continue;
    }
    result += content.slice(lastIndex, start) + replacer({ handle, userId });
    lastIndex = start + match[0].length;
  }
  return result + content.slice(lastIndex);
}

/** Split content into text and stored-token segments, preserving order. */
export type StoredMentionSegment =
  | { readonly kind: "text"; readonly text: string }
  | {
      readonly kind: "token";
      readonly handle: string;
      readonly userId: string;
    };

export function splitContentByStoredMentions(
  content: string,
): StoredMentionSegment[] {
  const segments: StoredMentionSegment[] = [];
  let lastIndex = 0;
  for (const match of content.matchAll(MENTION_TOKEN_REGEX)) {
    const start = match.index;
    const handle = match[1];
    const userId = match[2];
    if (start === undefined || handle === undefined || userId === undefined) {
      continue;
    }
    if (start > lastIndex) {
      segments.push({ kind: "text", text: content.slice(lastIndex, start) });
    }
    segments.push({ kind: "token", handle, userId });
    lastIndex = start + match[0].length;
  }
  if (lastIndex < content.length) {
    segments.push({ kind: "text", text: content.slice(lastIndex) });
  }
  return segments;
}

/**
 * Handles typed as plain `@handle` text, ignoring stored tokens (their
 * handles may be stale after a rename and must not be re-resolved).
 */
export function extractPlainMentionHandles(content: string): string[] {
  return extractMentionHandles(replaceMentionTokens(content, () => ""));
}

export type CanonicalizedMentions = {
  /** Content with every recognized mention stored as a token. */
  readonly content: string;
  /** Unique mentioned user ids, in order of first appearance. */
  readonly mentionUserIds: string[];
};

/**
 * Canonicalize comment content for storage: plain `@handle` mentions the
 * resolver recognizes become `[@handle](user:userId)` tokens; already-stored
 * tokens pass through untouched (their handles may be stale by design).
 */
export function canonicalizeMentionContent(
  content: string,
  resolveHandle: (handle: string) => string | null,
): CanonicalizedMentions {
  // Stash existing tokens behind placeholders so their (possibly stale)
  // handles are never re-resolved as freshly typed mentions.
  const stashed: StoredMention[] = [];
  let working = replaceMentionTokens(content, (token) => {
    stashed.push(token);
    return `\u0000${stashed.length - 1}\u0000`;
  });

  const mentionUserIds: string[] = [];
  const pushId = (userId: string) => {
    if (!mentionUserIds.includes(userId)) {
      mentionUserIds.push(userId);
    }
  };

  let canonicalized = "";
  let lastIndex = 0;
  for (const match of working.matchAll(MENTION_REGEX)) {
    const raw = match[1];
    const start = match.index;
    if (raw === undefined || start === undefined) {
      continue;
    }
    canonicalized += working.slice(lastIndex, start);
    const handle = raw.toLowerCase();
    const userId = resolveHandle(handle);
    if (userId === null) {
      canonicalized += match[0];
    } else {
      pushId(userId);
      canonicalized += buildMentionToken(handle, userId);
    }
    lastIndex = start + match[0].length;
  }
  working = canonicalized + working.slice(lastIndex);

  const restored: string[] = [];
  let restoreIndex = 0;
  // oxlint-disable-next-line eslint/no-control-regex -- NUL is the intentional stash delimiter for stored mention tokens (see replaceMentionTokens); real comment content never contains NUL, so it is an unambiguous placeholder
  for (const match of working.matchAll(/\u0000(\d+)\u0000/g)) {
    const rawIndex = match[1];
    const start = match.index;
    if (rawIndex === undefined || start === undefined) {
      continue;
    }
    restored.push(working.slice(restoreIndex, start));
    const token = stashed[Number(rawIndex)];
    if (token) {
      pushId(token.userId);
      restored.push(buildMentionToken(token.handle, token.userId));
    } else {
      restored.push(match[0]);
    }
    restoreIndex = start + match[0].length;
  }
  working = restored.join("") + working.slice(restoreIndex);

  return { content: working, mentionUserIds };
}

/**
 * Turn stored tokens back into `@handle` text for editing (the composer
 * never shows raw tokens). Labels use the user's current username when
 * known, falling back to the handle captured at write time.
 */
export function deTokenizeForEditing(
  content: string,
  usernameByUserId: ReadonlyMap<string, string>,
): string {
  return replaceMentionTokens(content, (token) => {
    const username = usernameByUserId.get(token.userId);
    return `@${username ?? token.handle}`;
  });
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
