import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
  Outlet,
  RouterProvider,
} from "@tanstack/react-router";
import { SuspendedAccountNotice } from "src/components/auth/SuspendedAccountNotice";
import { PostVoteButtons } from "src/components/votes/PostVoteButtons";
import type { UserCapabilities } from "src/lib/auth/capabilities";
import { CapabilitiesProvider } from "src/lib/auth/capabilities.context";
import { VotesFnsContext, type VotesFns } from "src/lib/votes/votes.fn-context";
import { describe, expect, it } from "vitest";
import { render } from "vitest-browser-react";
import { page } from "vitest/browser";

const suspendedCapabilities: UserCapabilities = {
  actorId: "suspended-1",
  hasMutationActor: false,
  permissions: [],
  suspended: true,
  suspensionReason: "Spam links",
};

const votesFns = {
  fetchLikedPosts: async () => {
    throw new Error("Liked posts are not requested");
  },
  fetchPostVotes: async () => ({ dislikes: 2, likes: 8, userVote: null }),
  removePostVote: async () => {
    throw new Error("Vote mutation must stay hidden");
  },
  setPostVote: async () => {
    throw new Error("Vote mutation must stay hidden");
  },
} satisfies Record<keyof VotesFns, unknown>;

describe("suspended account actions", () => {
  it("shows the shared notice and omits vote actions", async () => {
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });

    const rootRoute = createRootRoute({
      component: () => (
        <CapabilitiesProvider capabilities={suspendedCapabilities}>
          <Outlet />
        </CapabilitiesProvider>
      ),
    });
    const suspendedRoute = createRoute({
      getParentRoute: () => rootRoute,
      path: "/suspended",
      component: () => (
        <QueryClientProvider client={queryClient}>
          <VotesFnsContext.Provider
            // SAFETY: the vote query returns test data; mutation fakes throw if called.
            value={votesFns as unknown as VotesFns}
          >
            <SuspendedAccountNotice />
            <PostVoteButtons postId={42} />
          </VotesFnsContext.Provider>
        </QueryClientProvider>
      ),
    });
    const router = createRouter({
      history: createMemoryHistory({ initialEntries: ["/suspended"] }),
      routeTree: rootRoute.addChildren([suspendedRoute]),
    });
    await render(<RouterProvider router={router} />);
    await router.load();

    await expect(
      page.getByRole("status", { name: "Account suspension" }),
    ).toBeVisible();
    await expect(page.getByText("Reason: Spam links")).toBeVisible();
    expect(page.getByRole("button", { name: "Like post" }).query()).toBeNull();
    expect(
      page.getByRole("button", { name: "Dislike post" }).query(),
    ).toBeNull();
  });
});
