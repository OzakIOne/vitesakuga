// @vitest-environment happy-dom
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { VotesFnsContext } from "./votes.fn-context";
import { usePostVotes, useSetVote } from "./votes.hooks";

vi.mock("src/lib/votes/votes.service", () => ({
  fetchPostVotes: vi.fn(),
  removePostVote: vi.fn(),
  setPostVote: vi.fn(),
}));

vi.mock("src/components/ui/toaster", () => ({
  toaster: {
    create: vi.fn(),
  },
}));

import { fetchPostVotes } from "src/lib/votes/votes.service";

const summary = { dislikes: 0, likes: 0, userVote: null as null };

const createWrapper = (
  queryClient: QueryClient,
  fns: Partial<{
    fetchPostVotes: ReturnType<typeof vi.fn>;
    removePostVote: ReturnType<typeof vi.fn>;
    setPostVote: ReturnType<typeof vi.fn>;
  }> = {},
) => {
  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>
      <VotesFnsContext.Provider
        value={{
          fetchPostVotes: fns.fetchPostVotes ?? vi.fn(),
          removePostVote: fns.removePostVote ?? vi.fn(),
          setPostVote: fns.setPostVote ?? vi.fn(),
        }}
      >
        {children}
      </VotesFnsContext.Provider>
    </QueryClientProvider>
  );
};

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
    const { result } = renderHook(() => useSetVote(42), {
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
    const { result } = renderHook(() => useSetVote(42), {
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
    const { result } = renderHook(() => useSetVote(42), {
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
    const { result } = renderHook(() => useSetVote(42), {
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
    vi.mocked(fetchPostVotes).mockReset();
  });

  it("fetches the vote summary for a post", async () => {
    vi.mocked(fetchPostVotes).mockResolvedValueOnce({
      dislikes: 2,
      likes: 5,
      userVote: "like",
    });
    const { result } = renderHook(() => usePostVotes(42), {
      wrapper: createWrapper(queryClient),
    });

    await waitFor(() => expect(result.current.data).toBeDefined());

    expect(fetchPostVotes).toHaveBeenCalledWith({ data: 42 });
    expect(result.current.data).toEqual({
      dislikes: 2,
      likes: 5,
      userVote: "like",
    });
  });
});
