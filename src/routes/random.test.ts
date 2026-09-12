import { isNotFound, isRedirect } from "@tanstack/react-router";
import { asPostId } from "src/lib/ids";
import { fetchRandomPostId } from "src/lib/posts/posts.service";
import { afterEach, describe, expect, it, vi } from "vitest";

import { loadRandomVideo } from "./random";

vi.mock("src/lib/posts/posts.service", () => ({
  fetchRandomPostId: vi.fn(),
}));

describe("random post route", () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it("redirects to a random post detail page", async () => {
    vi.mocked(fetchRandomPostId).mockResolvedValue(asPostId(42));

    const rejection = await loadRandomVideo().then(
      () => null,
      (error: unknown) => error,
    );

    expect(fetchRandomPostId).toHaveBeenCalledWith({
      data: {
        randomSeed: expect.any(Number),
      },
    });
    expect(isRedirect(rejection)).toBe(true);

    if (!isRedirect(rejection)) return;

    expect(rejection.options.to).toBe("/posts/$postId");
    expect(rejection.options.params).toEqual({ postId: "42" });
  });

  it("returns not found when no post is available", async () => {
    vi.mocked(fetchRandomPostId).mockResolvedValue(null);

    const rejection = await loadRandomVideo().then(
      () => null,
      (error: unknown) => error,
    );

    expect(isNotFound(rejection)).toBe(true);
  });
});
