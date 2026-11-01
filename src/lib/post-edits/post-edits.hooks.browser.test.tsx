import {
  QueryClient,
  QueryClientProvider,
  useQuery,
} from "@tanstack/react-query";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderHook } from "vitest-browser-react";

import { postsKeys } from "../posts/posts.queries";
import {
  PostEditsFnsContext,
  type PostEditsFns,
} from "./post-edits.fn-context";
import { useApprovePostEdit } from "./post-edits.hooks";
import { postEditsKeys } from "./post-edits.queries";

const POST_ID = 42;

describe(useApprovePostEdit, () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
  });

  it("refetches the post detail and its edit history once a suggestion is applied", async () => {
    const counts = { detail: 0, history: 0 };
    const approveEdit = vi.fn(async () => ({ ok: true }));
    const fns = { approveEdit };
    const wrapper = ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={queryClient}>
        <PostEditsFnsContext.Provider
          // SAFETY: useApprovePostEdit only calls approveEdit; the other
          // post-edit server functions are never invoked.
          value={fns as unknown as PostEditsFns}
        >
          {children}
        </PostEditsFnsContext.Provider>
      </QueryClientProvider>
    );
    const { result } = await renderHook(
      () => ({
        approve: useApprovePostEdit(POST_ID),
        detail: useQuery({
          queryFn: async () => {
            counts.detail += 1;
            return { id: POST_ID };
          },
          queryKey: postsKeys.detail(POST_ID),
        }),
        history: useQuery({
          queryFn: async () => {
            counts.history += 1;
            return [];
          },
          queryKey: postEditsKeys.post(POST_ID),
        }),
      }),
      { wrapper },
    );
    await vi.waitFor(() => {
      expect(result.current.detail.data).toBeDefined();
      expect(result.current.history.data).toBeDefined();
    });

    result.current.approve.mutate({ editId: 1, operationKey: "approve-1" });

    await vi.waitFor(() => expect(counts.detail).toBeGreaterThan(1));
    expect(counts.history).toBeGreaterThan(1);
    expect(approveEdit).toHaveBeenCalledWith({
      data: { editId: 1, operationKey: "approve-1" },
    });
  });
});
