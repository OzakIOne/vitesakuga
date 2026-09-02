import { describe, expect, it } from "vitest";

import {
  extractMentionHandles,
  slugifyUsername,
  splitContentByMentions,
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

describe(USERNAME_PATTERN, () => {
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
