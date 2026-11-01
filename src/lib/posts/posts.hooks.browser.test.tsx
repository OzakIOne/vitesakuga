import {
  QueryClient,
  QueryClientProvider,
  useQuery,
} from "@tanstack/react-query";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderHook } from "vitest-browser-react";

import { PostsFnsContext, type PostsFns } from "./posts.fn-context";
import { useUpdatePost } from "./posts.hooks";
import { postsKeys } from "./posts.queries";

const POST_ID = 42;

const post = { id: POST_ID, relatedPostId: null, version: 3 };

const editFields = {
  animeTitle: null,
  chapterNumber: null,
  description: "A corrected description",
  episodeNumber: null,
  operationKey: "post-update:42:3:op",
  seasonNumber: null,
  sourceType: null,
  tags: [],
  title: "A corrected title",
  volumeNumber: null,
};

describe(useUpdatePost, () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
  });

  it("refetches the post detail after a saved edit", async () => {
    let detailFetches = 0;
    const updatePost = vi.fn(async () => ({ ok: true }));
    const fns = { updatePost };
    const wrapper = ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={queryClient}>
        <PostsFnsContext.Provider
          // SAFETY: useUpdatePost only calls updatePost; the other posts
          // server functions are never invoked.
          value={fns as unknown as PostsFns}
        >
          {children}
        </PostsFnsContext.Provider>
      </QueryClientProvider>
    );
    const { result } = await renderHook(
      () => ({
        detail: useQuery({
          queryFn: async () => {
            detailFetches += 1;
            return { id: POST_ID, title: `Fetch ${detailFetches}` };
          },
          queryKey: postsKeys.detail(POST_ID),
        }),
        update: useUpdatePost(post),
      }),
      { wrapper },
    );
    await vi.waitFor(() => expect(result.current.detail.data).toBeDefined());

    result.current.update.mutate(editFields);

    await vi.waitFor(() => expect(detailFetches).toBeGreaterThan(1));
    expect(updatePost).toHaveBeenCalledWith({
      data: expect.objectContaining({
        expectedVersion: 3,
        postId: POST_ID,
        title: "A corrected title",
      }),
    });
  });
});
