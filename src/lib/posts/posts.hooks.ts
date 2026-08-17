import type {
  InfiniteData,
  QueryKey,
  UseInfiniteQueryOptions,
} from "@tanstack/react-query";
import { useInfiniteQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate, type RegisteredRouter } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import type { PostWithVotes } from "../db/schema";
import type { PaginationMeta } from "../pagination/pagination";
import { computeAnchorPostIndex } from "./posts.queries";

type PopularTag = {
  id: number;
  name: string;
  postCount: number;
};

type InfinitePostsPage = {
  readonly data: readonly PostWithVotes[];
  meta: {
    pagination: PaginationMeta;
    popularTags: PopularTag[];
  };
};

type RegisteredFullPaths =
  RegisteredRouter["routesByPath"][keyof RegisteredRouter["routesByPath"]]["fullPath"];

export type PostsInfiniteState<
  TData extends InfinitePostsPage = InfinitePostsPage,
> = {
  allPosts: readonly PostWithVotes[];
  anchorPostIndex: number | null;
  anchorScrollKey: number;
  fetchNextPage: () => void;
  fetchPreviousPage: () => void;
  firstPage: TData | undefined;
  hasNextPage: boolean;
  hasPreviousPage: boolean;
  isFetching: boolean;
  isFetchingNextPage: boolean;
  isFetchingPreviousPage: boolean;
  isPending: boolean;
  pageParams: readonly number[];
  pageSize: number;
  popularTags: PopularTag[];
  syncPageToUrl: (page: number) => void;
};

export function usePostsInfiniteScroll<
  TData extends InfinitePostsPage,
  TQueryKey extends QueryKey,
>(
  from: RegisteredFullPaths,
  infiniteOptions: UseInfiniteQueryOptions<
    TData,
    Error,
    InfiniteData<TData, unknown>,
    TQueryKey,
    number
  >,
): PostsInfiniteState<TData> {
  const navigate = useNavigate({ from });
  const queryClient = useQueryClient();
  const page = infiniteOptions.initialPageParam;

  const {
    data,
    fetchNextPage,
    fetchPreviousPage,
    hasNextPage,
    hasPreviousPage,
    isFetching,
    isFetchingNextPage,
    isFetchingPreviousPage,
    isPending,
  } = useInfiniteQuery(infiniteOptions);

  // The last page we wrote to the URL ourselves during scroll. Used to tell
  // our own scroll-driven writes apart from external changes (back/forward,
  // typed URL, pagination links) which must reset the query to the new anchor.
  const lastWrittenPageRef = useRef(page);

  const [anchorScrollKey, setAnchorScrollKey] = useState(0);

  useEffect(() => {
    if (page === lastWrittenPageRef.current) return;
    lastWrittenPageRef.current = page;
    setAnchorScrollKey((key) => key + 1);
    void queryClient.resetQueries({ queryKey: infiniteOptions.queryKey });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- queryKey identity is unstable; only page drives resets
  }, [page, queryClient]);

  // Prefetch the buffer pages (N-1 and N+1) as soon as the anchor page loads.
  // We fetch previous first, then next, sequentially: TanStack Query's
  // concurrent fetch* calls on the same infinite query race (the second one
  // overwrites the first's cache write), so buffers must not overlap.
  const prefetchedAnchorRef = useRef<number | null>(null);
  const fetchNextPageRef = useRef(fetchNextPage);
  const hasNextPageRef = useRef(hasNextPage);
  const isFetchingNextPageRef = useRef(isFetchingNextPage);

  useEffect(() => {
    fetchNextPageRef.current = fetchNextPage;
    hasNextPageRef.current = hasNextPage;
    isFetchingNextPageRef.current = isFetchingNextPage;
  }, [fetchNextPage, hasNextPage, isFetchingNextPage]);

  useEffect(() => {
    if (prefetchedAnchorRef.current === page) return;
    if (!data) return;
    prefetchedAnchorRef.current = page;
    if (hasPreviousPage && !isFetchingPreviousPage) {
      void fetchPreviousPage().then(() => {
        if (hasNextPageRef.current && !isFetchingNextPageRef.current) {
          void fetchNextPageRef.current();
        }
      });
    } else if (hasNextPage && !isFetchingNextPage) {
      void fetchNextPage();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- refs carry the latest fetchNextPage/hasNextPage/isFetchingNextPage values
  }, [data, fetchPreviousPage, hasPreviousPage, isFetchingPreviousPage, page]);

  const syncPageToUrl = useCallback(
    (nextPage: number) => {
      if (nextPage === lastWrittenPageRef.current) return;
      lastWrittenPageRef.current = nextPage;
      void navigate({
        search: (prev) => ({ ...prev, page: nextPage }),
        replace: true,
        // This navigation is driven by our own scroll position, so it must not
        // trigger TanStack Router's default scroll-to-top: on mobile the window
        // itself is scrollable and resetting it yanks the whole page up when a
        // new infinite-scroll page becomes visible.
        resetScroll: false,
      });
    },
    [navigate],
  );

  const allPosts = useMemo(
    () => data?.pages.flatMap((p) => p.data) ?? [],
    [data],
  );

  const pageParams = useMemo(
    () => (data?.pageParams ?? []) as readonly number[],
    [data],
  );

  const pageItemCounts = useMemo(
    () => data?.pages.map((p) => p.data.length) ?? [],
    [data],
  );

  const pageSize = data?.pages[0]?.meta.pagination.limit ?? 30;

  const anchorLoaded = pageParams.includes(page);
  const anchorPageIdx = pageParams.indexOf(page);
  const anchorPageHasPrevious =
    anchorPageIdx >= 0
      ? (data?.pages[anchorPageIdx]?.meta.pagination.hasPrevious ?? true)
      : true;
  const previousBufferLoaded = pageParams.includes(page - 1);
  const anchorReady =
    anchorLoaded && (previousBufferLoaded || !anchorPageHasPrevious);

  const anchorPostIndex = anchorReady
    ? computeAnchorPostIndex(pageParams, page, pageItemCounts)
    : null;

  const popularTags = useMemo(
    () => data?.pages[0]?.meta.popularTags ?? [],
    [data],
  );

  return {
    allPosts,
    anchorPostIndex,
    anchorScrollKey,
    fetchNextPage,
    fetchPreviousPage,
    firstPage: data?.pages[0],
    hasNextPage,
    hasPreviousPage,
    isFetching,
    isFetchingNextPage,
    isFetchingPreviousPage,
    isPending,
    pageParams,
    pageSize: pageSize ?? 30,
    popularTags,
    syncPageToUrl,
  };
}
