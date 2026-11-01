import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderHook } from "vitest-browser-react";

import { CommentsFnsContext, type CommentsFns } from "./comments.fn-context";
import { useAddComment, useDeleteComment } from "./comments.hooks";

vi.mock("src/components/ui/toaster", () => ({
  toaster: {
    create: vi.fn(),
  },
}));

const createWrapper = (
  queryClient: QueryClient,
  fns: Partial<Record<keyof CommentsFns, unknown>> = {},
) => {
  const fakes = {
    addComment: vi.fn(),
    deleteComment: vi.fn(),
    fetchComments: vi.fn(),
    updateComment: vi.fn(),
    ...fns,
  };
  return ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>
      <CommentsFnsContext.Provider
        // SAFETY: the hooks under test only call the fakes above; the
        // remaining comment server functions are never invoked.
        value={fakes as unknown as CommentsFns}
      >
        {children}
      </CommentsFnsContext.Provider>
    </QueryClientProvider>
  );
};

const waitFor = vi.waitFor;

describe(useAddComment, () => {
  let queryClient: QueryClient;
  let mockAddComment: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    mockAddComment = vi.fn();
  });

  it("calls addComment with the correct payload", async () => {
    mockAddComment.mockResolvedValueOnce({ id: 1 });
    const { result } = await renderHook(() => useAddComment(42, "user-1"), {
      wrapper: createWrapper(queryClient, { addComment: mockAddComment }),
    });

    result.current.mutate("Nice post!");
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(mockAddComment).toHaveBeenCalledWith({
      data: { postId: 42, content: "Nice post!" },
    });
  });

  it("invalidates comments query on success", async () => {
    const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");
    mockAddComment.mockResolvedValueOnce({ id: 1 });
    const { result } = await renderHook(() => useAddComment(42, "user-1"), {
      wrapper: createWrapper(queryClient, { addComment: mockAddComment }),
    });

    result.current.mutate("Nice!");
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(invalidateSpy).toHaveBeenCalledWith(
      expect.objectContaining({ queryKey: ["comments", "post", 42] }),
    );
  });

  it("shows error toast on failure", async () => {
    mockAddComment.mockRejectedValueOnce(new Error("DB error"));
    const { result } = await renderHook(() => useAddComment(1, "user-1"), {
      wrapper: createWrapper(queryClient, { addComment: mockAddComment }),
    });

    result.current.mutate("Bad comment");
    await waitFor(() => expect(result.current.isError).toBe(true));

    const { toaster } = await import("src/components/ui/toaster");
    expect(toaster.create).toHaveBeenCalledWith(
      expect.objectContaining({ title: "Error adding comment" }),
    );
  });
});

describe(useDeleteComment, () => {
  let queryClient: QueryClient;
  let mockDeleteComment: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    mockDeleteComment = vi.fn();
  });

  it("calls deleteComment with the correct payload", async () => {
    mockDeleteComment.mockResolvedValueOnce({ success: true });
    const { result } = await renderHook(() => useDeleteComment(42), {
      wrapper: createWrapper(queryClient, { deleteComment: mockDeleteComment }),
    });

    result.current.mutate({ commentId: 99 });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(mockDeleteComment).toHaveBeenCalledWith({
      data: { commentId: 99 },
    });
  });

  it("invalidates comments query on success", async () => {
    const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");
    mockDeleteComment.mockResolvedValueOnce({ success: true });
    const { result } = await renderHook(() => useDeleteComment(42), {
      wrapper: createWrapper(queryClient, { deleteComment: mockDeleteComment }),
    });

    result.current.mutate({ commentId: 1 });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(invalidateSpy).toHaveBeenCalledWith(
      expect.objectContaining({ queryKey: ["comments", "post", 42] }),
    );
  });

  it("shows error toast on failure", async () => {
    mockDeleteComment.mockRejectedValueOnce(new Error("Forbidden"));
    const { result } = await renderHook(() => useDeleteComment(1), {
      wrapper: createWrapper(queryClient, { deleteComment: mockDeleteComment }),
    });

    result.current.mutate({ commentId: 99 });
    await waitFor(() => expect(result.current.isError).toBe(true));

    const { toaster } = await import("src/components/ui/toaster");
    expect(toaster.create).toHaveBeenCalledWith(
      expect.objectContaining({ title: "Error deleting comment" }),
    );
  });
});
