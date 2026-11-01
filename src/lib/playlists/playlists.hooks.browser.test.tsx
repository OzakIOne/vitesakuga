import {
  QueryClient,
  QueryClientProvider,
  useInfiniteQuery,
  useQuery,
} from "@tanstack/react-query";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderHook } from "vitest-browser-react";

import { PlaylistsFnsContext, type PlaylistsFns } from "./playlists.fn-context";
import {
  useBulkAddPostsToPlaylist,
  useBulkRemovePostsFromPlaylist,
  useReorderPlaylistPosts,
  useSetPostPlaylistMembership,
} from "./playlists.hooks";
import { playlistsKeys } from "./playlists.queries";

const USER_ID = "user-1";
const PLAYLIST_ID = 7;
const OTHER_PLAYLIST_ID = 8;
const POST_ID = 42;
const OTHER_POST_ID = 43;

const emptyPage = { data: [], meta: { pagination: { hasMore: false } } };

type FetchCounts = {
  detail: number;
  forPost: number;
  otherDetail: number;
  otherForPost: number;
  userPlaylists: number;
};

const createFixture = (queryClient: QueryClient) => {
  const memberships = new Set<number>();
  const fetches: FetchCounts = {
    detail: 0,
    forPost: 0,
    otherDetail: 0,
    otherForPost: 0,
    userPlaylists: 0,
  };
  const observedDuringRequest: unknown[] = [];

  const addPostToPlaylist = vi.fn(
    async ({ data }: { data: { playlistId: number; postId: number } }) => {
      observedDuringRequest.push(
        queryClient.getQueryData(playlistsKeys.forPost(POST_ID)),
      );
      memberships.add(data.playlistId);
      return { ok: true };
    },
  );
  const removePostFromPlaylist = vi.fn(
    async ({ data }: { data: { playlistId: number; postId: number } }) => {
      observedDuringRequest.push(
        queryClient.getQueryData(playlistsKeys.forPost(POST_ID)),
      );
      throw new Error(`Playlist ${data.playlistId} is unavailable`);
    },
  );
  const bulkAddPostsToPlaylist = vi.fn(async () => ({ ok: true }));
  const bulkRemovePostsFromPlaylist = vi.fn(async () => ({ ok: true }));
  const reorderPlaylistPosts = vi.fn(async () => ({ ok: true }));

  const fns = {
    addPostToPlaylist,
    bulkAddPostsToPlaylist,
    bulkRemovePostsFromPlaylist,
    removePostFromPlaylist,
    reorderPlaylistPosts,
  };

  const useObservedCaches = () => ({
    detail: useInfiniteQuery({
      getNextPageParam: () => undefined,
      initialPageParam: 0,
      queryFn: async () => {
        fetches.detail += 1;
        return emptyPage;
      },
      queryKey: playlistsKeys.detailForPlaylist(PLAYLIST_ID),
    }),
    otherDetail: useInfiniteQuery({
      getNextPageParam: () => undefined,
      initialPageParam: 0,
      queryFn: async () => {
        fetches.otherDetail += 1;
        return emptyPage;
      },
      queryKey: playlistsKeys.detailForPlaylist(OTHER_PLAYLIST_ID),
    }),
    otherForPost: useQuery({
      queryFn: async () => {
        fetches.otherForPost += 1;
        return [];
      },
      queryKey: playlistsKeys.forPost(OTHER_POST_ID),
    }),
    forPost: useQuery({
      queryFn: async () => {
        fetches.forPost += 1;
        return [
          {
            contains_post: memberships.has(PLAYLIST_ID),
            id: PLAYLIST_ID,
            title: "Favorites",
          },
        ];
      },
      queryKey: playlistsKeys.forPost(POST_ID),
    }),
    userPlaylists: useQuery({
      queryFn: async () => {
        fetches.userPlaylists += 1;
        return [];
      },
      queryKey: playlistsKeys.userPlaylists(USER_ID),
    }),
  });

  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>
      <PlaylistsFnsContext.Provider
        // SAFETY: the hooks under test only call the fakes above; the other
        // playlist server functions are never invoked.
        value={fns as unknown as PlaylistsFns}
      >
        {children}
      </PlaylistsFnsContext.Provider>
    </QueryClientProvider>
  );

  return {
    fetches,
    memberships,
    observedDuringRequest,
    useObservedCaches,
    wrapper,
  };
};

const waitForInitialLoad = async (
  getObserved: () => ReturnType<
    ReturnType<typeof createFixture>["useObservedCaches"]
  >,
) => {
  await vi.waitFor(() => {
    const observed = getObserved();
    expect(observed.detail.data).toBeDefined();
    expect(observed.forPost.data).toBeDefined();
    expect(observed.userPlaylists.data).toBeDefined();
    expect(observed.otherDetail.data).toBeDefined();
    expect(observed.otherForPost.data).toBeDefined();
  });
};

const expectOnlyTargetedCachesRefetched = (
  fetches: FetchCounts,
  before: FetchCounts,
) => {
  expect(fetches.detail).toBeGreaterThan(before.detail);
  expect(fetches.forPost).toBeGreaterThan(before.forPost);
  expect(fetches.userPlaylists).toBeGreaterThan(before.userPlaylists);
  expect(fetches.otherDetail).toBe(before.otherDetail);
  expect(fetches.otherForPost).toBe(before.otherForPost);
};

describe(useSetPostPlaylistMembership, () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
  });

  it("checks the playlist optimistically, then refetches the post, playlist and user lists", async () => {
    const fixture = createFixture(queryClient);
    const { result } = await renderHook(
      () => ({
        membership: useSetPostPlaylistMembership({
          postId: POST_ID,
          userId: USER_ID,
        }),
        observed: fixture.useObservedCaches(),
      }),
      { wrapper: fixture.wrapper },
    );
    await waitForInitialLoad(() => result.current.observed);
    const before = { ...fixture.fetches };

    result.current.membership.mutate({
      contains: true,
      playlistId: PLAYLIST_ID,
    });

    await vi.waitFor(() =>
      expect(fixture.memberships.has(PLAYLIST_ID)).toBe(true),
    );
    expect(fixture.observedDuringRequest[0]).toEqual([
      { contains_post: true, id: PLAYLIST_ID, title: "Favorites" },
    ]);
    await vi.waitFor(() =>
      expectOnlyTargetedCachesRefetched(fixture.fetches, before),
    );
  });

  it("refetches the post's playlist list after a failed removal so the checkbox shows the server state", async () => {
    const fixture = createFixture(queryClient);
    fixture.memberships.add(PLAYLIST_ID);
    const { result } = await renderHook(
      () => ({
        membership: useSetPostPlaylistMembership({
          postId: POST_ID,
          userId: USER_ID,
        }),
        observed: fixture.useObservedCaches(),
      }),
      { wrapper: fixture.wrapper },
    );
    await waitForInitialLoad(() => result.current.observed);
    const before = { ...fixture.fetches };

    result.current.membership.mutate({
      contains: false,
      playlistId: PLAYLIST_ID,
    });

    await vi.waitFor(() =>
      expect(result.current.observed.forPost.data).toEqual([
        { contains_post: true, id: PLAYLIST_ID, title: "Favorites" },
      ]),
    );
    expect(fixture.observedDuringRequest[0]).toEqual([
      { contains_post: false, id: PLAYLIST_ID, title: "Favorites" },
    ]);
    await vi.waitFor(() =>
      expectOnlyTargetedCachesRefetched(fixture.fetches, before),
    );
  });
});

describe(useBulkAddPostsToPlaylist, () => {
  it("refreshes the playlist, the user's playlists and the post's playlist list", async () => {
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    const fixture = createFixture(queryClient);
    const { result } = await renderHook(
      () => ({
        bulkAdd: useBulkAddPostsToPlaylist({
          playlistId: PLAYLIST_ID,
          userId: USER_ID,
        }),
        observed: fixture.useObservedCaches(),
      }),
      { wrapper: fixture.wrapper },
    );
    await waitForInitialLoad(() => result.current.observed);
    const before = { ...fixture.fetches };

    result.current.bulkAdd.mutate([POST_ID]);

    await vi.waitFor(() =>
      expectOnlyTargetedCachesRefetched(fixture.fetches, before),
    );
  });
});

describe(useBulkRemovePostsFromPlaylist, () => {
  it("refreshes the playlist, the user's playlists and the post's playlist list", async () => {
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    const fixture = createFixture(queryClient);
    const { result } = await renderHook(
      () => ({
        bulkRemove: useBulkRemovePostsFromPlaylist({
          playlistId: PLAYLIST_ID,
          userId: USER_ID,
        }),
        observed: fixture.useObservedCaches(),
      }),
      { wrapper: fixture.wrapper },
    );
    await waitForInitialLoad(() => result.current.observed);
    const before = { ...fixture.fetches };

    result.current.bulkRemove.mutate([POST_ID]);

    await vi.waitFor(() =>
      expectOnlyTargetedCachesRefetched(fixture.fetches, before),
    );
  });
});

describe(useReorderPlaylistPosts, () => {
  it("refreshes the playlist detail and the post's playlist list once the order is saved", async () => {
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    const fixture = createFixture(queryClient);
    const { result } = await renderHook(
      () => ({
        observed: fixture.useObservedCaches(),
        reorder: useReorderPlaylistPosts(),
      }),
      { wrapper: fixture.wrapper },
    );
    await waitForInitialLoad(() => result.current.observed);
    const before = { ...fixture.fetches };

    result.current.reorder.mutate({
      playlistId: PLAYLIST_ID,
      postIds: [POST_ID],
    });

    await vi.waitFor(() =>
      expect(fixture.fetches.detail).toBeGreaterThan(before.detail),
    );
    await vi.waitFor(() =>
      expect(fixture.fetches.forPost).toBeGreaterThan(before.forPost),
    );
  });
});
