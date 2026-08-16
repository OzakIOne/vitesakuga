import type { QueryKey, UseQueryOptions } from "@tanstack/react-query";
import {
  useInfiniteQuery,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import type { PostWithVotes } from "../db/schema";
import type { PaginationMeta } from "../pagination/pagination";
import {
  computeAnchorPostIndex,
  postsInfiniteQueryOptions,
} from "./posts.queries";
import type { PostsSearchParams } from "./posts.schema";

type PopularTag = {
  id: number;
  name: string;
  postCount: number;
};

export type PostListingData = {
  data: readonly PostWithVotes[];
  meta: {
    pagination: PaginationMeta;
    popularTags: PopularTag[];
  };
};

export type PostsInfiniteState = {
  allPosts: readonly PostWithVotes[];
  anchorPostIndex: number | null;
  anchorScrollKey: number;
  fetchNextPage: () => void;
  fetchPreviousPage: () => void;
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

export function usePostsInfiniteScroll(
  searchParams: PostsSearchParams,
): PostsInfiniteState {
  const navigate = useNavigate({ from: "/posts/" });
  const queryClient = useQueryClient();
  const { page } = searchParams;

  const infiniteOptions = postsInfiniteQueryOptions(searchParams);

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
    void queryClient.resetQueries({
      queryKey: postsInfiniteQueryOptions(searchParams).queryKey,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- queryKey identity is unstable; only page drives resets
  }, [page, queryClient]);

  // Prefetch the buffer pages (N-1 and N+1) as soon as the anchor page loads.
  // We fetch previous first, then next, sequentially: TanStack Query's
  // concurrent fetch* calls on the same infinite query race (the second one
  // overwrites the first's cache write), so buffers must not overlap.
  const prefetchedAnchorRef = useRef<number | null>(null);
  const fetchNextPageRef = useRef(fetchNextPage);
  fetchNextPageRef.current = fetchNextPage;
  const hasNextPageRef = useRef(hasNextPage);
  hasNextPageRef.current = hasNextPage;
  const isFetchingNextPageRef = useRef(isFetchingNextPage);
  isFetchingNextPageRef.current = isFetchingNextPage;

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

export function usePostsPage<
  TData extends PostListingData,
  TQueryKey extends QueryKey = QueryKey,
>(queryOptions: UseQueryOptions<TData, Error, TData, TQueryKey>) {
  const navigate = useNavigate();
  const previousDataRef = useRef<TData | undefined>(undefined);

  const { placeholderData: _placeholderData, ...restOptions } = queryOptions;

  const { data, isFetching } = useQuery({
    ...restOptions,
    ...(previousDataRef.current !== undefined
      ? { placeholderData: previousDataRef.current }
      : {}),
  } as UseQueryOptions<TData, Error, TData, TQueryKey>);

  if (data) {
    previousDataRef.current = data;
  }

  const handlePageChange = useCallback(
    (newPage: number) => {
      void navigate({
        search: ((prev: Record<string, unknown>) => ({
          ...prev,
          page: newPage,
        })) as never,
      });
      window.scrollTo({ behavior: "smooth", top: 0 });
    },
    [navigate],
  );

  return {
    data,
    handlePageChange,
    isFetching,
    popularTags: data?.meta?.popularTags ?? [],
    posts: data?.data ?? [],
    totalPages: data?.meta?.pagination?.totalPages ?? 0,
  };
}
