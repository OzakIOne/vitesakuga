import { describe, expect, it } from "vitest";

import {
  canonicalizeMentionContent,
  deTokenizeForEditing,
  extractMentionHandles,
  extractPlainMentionHandles,
  replaceMentionTokens,
  slugifyUsername,
  splitContentByMentions,
  splitContentByStoredMentions,
  USERNAME_PATTERN,
} from "./mentions";

describe(extractMentionHandles, () => {
  it("extracts a single mention", () => {
    expect(extractMentionHandles("hey @john_doe look")).toEqual(["john_doe"]);
  });

  it("extracts multiple distinct mentions in order", () => {
    expect(extractMentionHandles("@jane and @john")).toEqual(["jane", "john"]);
  });

  it("deduplicates repeated mentions", () => {
    expect(extractMentionHandles("@jane @jane @jane")).toEqual(["jane"]);
  });

  it("ignores handles that are too short", () => {
    expect(extractMentionHandles("hey @ab")).toEqual([]);
  });

  it("ignores emails", () => {
    expect(extractMentionHandles("contact me at mail@john.com")).toEqual([]);
  });

  it("ignores mentions embedded in longer words", () => {
    expect(extractMentionHandles("prefix@jane and @janedoe_ suffix")).toEqual([
      "janedoe_",
    ]);
  });

  it("matches mentions at the start and after punctuation", () => {
    expect(extractMentionHandles("@jane,(@john)!")).toEqual(["jane", "john"]);
  });

  it("lowercases case-insensitive matches", () => {
    expect(extractMentionHandles("Hey @Jane_Doe!")).toEqual(["jane_doe"]);
  });
});

describe(splitContentByMentions, () => {
  it("returns the whole content as text without mentions", () => {
    expect(splitContentByMentions("no mentions here")).toEqual([
      { kind: "text", text: "no mentions here" },
    ]);
  });

  it("splits text around mentions", () => {
    expect(splitContentByMentions("hi @jane!")).toEqual([
      { kind: "text", text: "hi " },
      { kind: "mention", handle: "jane" },
      { kind: "text", text: "!" },
    ]);
  });

  it("does not match mentions glued to a previous word", () => {
    // `@john` after `@jane` is preceded by a letter, so only `jane` matches.
    expect(splitContentByMentions("@jane@john")).toEqual([
      { kind: "mention", handle: "jane" },
      { kind: "text", text: "@john" },
    ]);
  });
});

describe("USERNAME_PATTERN", () => {
  it.each(["jane", "jane_doe", "a".repeat(30)])(
    "accepts %s",
    (username: string) => {
      expect(USERNAME_PATTERN.test(username)).toBe(true);
    },
  );

  it.each(["ab", "Jane", "jane-doe", "jane doe", "a".repeat(31)])(
    "rejects %s",
    (username: string) => {
      expect(USERNAME_PATTERN.test(username)).toBe(false);
    },
  );
});

describe(slugifyUsername, () => {
  it("slugs a display name", () => {
    expect(slugifyUsername("Jane Doe")).toBe("jane_doe");
  });

  it("strips accents and special characters", () => {
    expect(slugifyUsername("Clément Çouriol!")).toBe("clement_couriol");
  });

  it("caps the slug so a suffix fits the max length", () => {
    expect(slugifyUsername("a".repeat(50)).length).toBeLessThanOrEqual(24);
  });

  it("pads unusable names to the minimum length", () => {
    expect(slugifyUsername("Jo")).toBe("user_jo");
    expect(slugifyUsername("🦊")).toBe("user_");
  });
});

describe(replaceMentionTokens, () => {
  it("replaces stored tokens via the replacer", () => {
    expect(
      replaceMentionTokens("a [@jane](user:u1) b", (t) => `<${t.userId}>`),
    ).toBe("a <u1> b");
  });

  it("leaves content without tokens untouched", () => {
    expect(replaceMentionTokens("no tokens", () => "X")).toBe("no tokens");
  });
});

describe(splitContentByStoredMentions, () => {
  it("splits text around stored tokens", () => {
    expect(splitContentByStoredMentions("hi [@jane](user:u1)!")).toEqual([
      { kind: "text", text: "hi " },
      { kind: "token", handle: "jane", userId: "u1" },
      { kind: "text", text: "!" },
    ]);
  });
});

describe(extractPlainMentionHandles, () => {
  it("ignores handles inside stored tokens", () => {
    expect(extractPlainMentionHandles("[@jane](user:u1) and @john")).toEqual([
      "john",
    ]);
  });
});

describe(canonicalizeMentionContent, () => {
  it("tokenizes recognized handles and lists their ids", () => {
    const result = canonicalizeMentionContent("hey @jane and @john", (h) =>
      h === "jane" ? "u1" : h === "john" ? "u2" : null,
    );
    expect(result.content).toBe("hey [@jane](user:u1) and [@john](user:u2)");
    expect(result.mentionUserIds).toEqual(["u1", "u2"]);
  });

  it("leaves unknown handles as plain text", () => {
    const result = canonicalizeMentionContent("hey @ghost", () => null);
    expect(result.content).toBe("hey @ghost");
    expect(result.mentionUserIds).toEqual([]);
  });

  it("passes stored tokens through without re-resolving stale handles", () => {
    const result = canonicalizeMentionContent(
      "old [@janet](user:u9) and fresh @jane",
      (h) => (h === "jane" ? "u1" : null),
    );
    expect(result.content).toBe(
      "old [@janet](user:u9) and fresh [@jane](user:u1)",
    );
    expect(result.mentionUserIds).toEqual(["u1", "u9"]);
  });

  it("is stable on already-canonical content", () => {
    // Re-running canonicalization on stored content is stable even when the
    // stored handle no longer resolves.
    const once = canonicalizeMentionContent("hey @jane", (h) =>
      h === "jane" ? "u1" : null,
    ).content;
    const twice = canonicalizeMentionContent(once, () => null);
    expect(twice.content).toBe(once);
    expect(twice.mentionUserIds).toEqual(["u1"]);
  });
});

describe(deTokenizeForEditing, () => {
  it("turns tokens into current handles for the editor", () => {
    expect(
      deTokenizeForEditing("hi [@jane](user:u1)!", new Map([["u1", "jane_2"]])),
    ).toBe("hi @jane_2!");
  });

  it("falls back to the stored handle when the user row is gone", () => {
    expect(deTokenizeForEditing("hi [@jane](user:u1)!", new Map())).toBe(
      "hi @jane!",
    );
  });
});
