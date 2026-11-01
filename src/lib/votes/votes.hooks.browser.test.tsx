import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderHook } from "vitest-browser-react";

import { VotesFnsContext, type VotesFns } from "./votes.fn-context";
import { usePostVotes, useSetVote } from "./votes.hooks";

vi.mock("src/components/ui/toaster", () => ({
  toaster: {
    create: vi.fn(),
  },
}));

const summary = { dislikes: 0, likes: 0, userVote: null as null };

const createWrapper = (
  queryClient: QueryClient,
  fns: Partial<Record<keyof VotesFns, unknown>> = {},
) => {
  const fakes = {
    fetchLikedPosts: vi.fn(),
    fetchPostVotes: vi.fn(),
    removePostVote: vi.fn(),
    setPostVote: vi.fn(),
    ...fns,
  };
  return ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>
      <VotesFnsContext.Provider
        // SAFETY: the hooks under test only call the fakes above; the
        // remaining vote server functions are never invoked.
        value={fakes as unknown as VotesFns}
      >
        {children}
      </VotesFnsContext.Provider>
    </QueryClientProvider>
  );
};

const waitFor = vi.waitFor;

describe(useSetVote, () => {
  let queryClient: QueryClient;
  let mockSetPostVote: ReturnType<typeof vi.fn>;
  let mockRemovePostVote: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    queryClient.setQueryData(["post-votes", 42], summary);
    mockSetPostVote = vi.fn();
    mockRemovePostVote = vi.fn();
  });

  it("calls setPostVote with the correct payload", async () => {
    mockSetPostVote.mockResolvedValueOnce({
      dislikes: 0,
      likes: 1,
      userVote: "like",
    });
    const { result } = await renderHook(() => useSetVote(42), {
      wrapper: createWrapper(queryClient, {
        removePostVote: mockRemovePostVote,
        setPostVote: mockSetPostVote,
      }),
    });

    result.current.mutate("like");
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(mockSetPostVote).toHaveBeenCalledWith({
      data: { postId: 42, vote: "like" },
    });
  });

  it("calls removePostVote when the vote is null", async () => {
    mockRemovePostVote.mockResolvedValueOnce({
      dislikes: 0,
      likes: 0,
      userVote: null,
    });
    const { result } = await renderHook(() => useSetVote(42), {
      wrapper: createWrapper(queryClient, {
        removePostVote: mockRemovePostVote,
        setPostVote: mockSetPostVote,
      }),
    });

    result.current.mutate(null);
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(mockRemovePostVote).toHaveBeenCalledWith({
      data: { postId: 42 },
    });
  });

  it("updates the cache optimistically", async () => {
    mockSetPostVote.mockResolvedValueOnce({
      dislikes: 0,
      likes: 1,
      userVote: "like",
    });
    const { result } = await renderHook(() => useSetVote(42), {
      wrapper: createWrapper(queryClient, {
        removePostVote: mockRemovePostVote,
        setPostVote: mockSetPostVote,
      }),
    });

    result.current.mutate("like");

    await waitFor(() =>
      expect(queryClient.getQueryData(["post-votes", 42])).toEqual({
        dislikes: 0,
        likes: 1,
        userVote: "like",
      }),
    );
  });

  it("rolls back the cache on error", async () => {
    mockSetPostVote.mockRejectedValueOnce(new Error("DB error"));
    const { result } = await renderHook(() => useSetVote(42), {
      wrapper: createWrapper(queryClient, {
        removePostVote: mockRemovePostVote,
        setPostVote: mockSetPostVote,
      }),
    });

    result.current.mutate("like");
    await waitFor(() => expect(result.current.isError).toBe(true));

    expect(queryClient.getQueryData(["post-votes", 42])).toEqual(summary);
  });
});

describe(usePostVotes, () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
  });

  it("fetches the vote summary for a post", async () => {
    const mockFetchPostVotes = vi.fn().mockResolvedValueOnce({
      dislikes: 2,
      likes: 5,
      userVote: "like",
    });
    const { result } = await renderHook(() => usePostVotes(42), {
      wrapper: createWrapper(queryClient, {
        fetchPostVotes: mockFetchPostVotes,
      }),
    });

    await waitFor(() => expect(result.current.data).toBeDefined());

    expect(mockFetchPostVotes).toHaveBeenCalledWith({ data: 42 });
    expect(result.current.data).toEqual({
      dislikes: 2,
      likes: 5,
      userVote: "like",
    });
  });
});
