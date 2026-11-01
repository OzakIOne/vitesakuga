import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderHook } from "vitest-browser-react";

import {
  ModerationFnsContext,
  type ModerationFns,
} from "./moderation.fn-context";
import { useApprovePromotion, usePromotionQueue } from "./moderation.hooks";

const candidate = {
  activity: { comments: 0, likesReceived: 0, uploads: 0 },
  name: "Novice",
  totalPoints: 120,
  userId: "user-1",
};

describe(useApprovePromotion, () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
  });

  it("refetches the promotion queue once the candidate is approved", async () => {
    let queue = [candidate];
    const fetchPromotionQueue = vi.fn(async () => queue);
    const approvePromotion = vi.fn(async ({ data }: { data: string }) => {
      queue = [];
      return { userId: data };
    });
    const fns = { approvePromotion, fetchPromotionQueue };
    const wrapper = ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={queryClient}>
        <ModerationFnsContext.Provider
          // SAFETY: the hooks under test only read approvePromotion and
          // fetchPromotionQueue; the other server fetchers are never called.
          value={fns as unknown as ModerationFns}
        >
          {children}
        </ModerationFnsContext.Provider>
      </QueryClientProvider>
    );
    const { result } = await renderHook(
      () => ({ approve: useApprovePromotion(), queue: usePromotionQueue() }),
      { wrapper },
    );

    await vi.waitFor(() =>
      expect(result.current.queue.data).toEqual([candidate]),
    );

    result.current.approve.mutate("user-1");

    await vi.waitFor(() => expect(result.current.queue.data).toEqual([]));
    expect(approvePromotion).toHaveBeenCalledWith({ data: "user-1" });
    expect(fetchPromotionQueue).toHaveBeenCalledTimes(2);
  });
});
