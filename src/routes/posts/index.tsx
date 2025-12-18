import { Box, GridItem, Spinner, Stack, Text, VStack } from "@chakra-ui/react";
import { useSuspenseInfiniteQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { Suspense, useCallback, useEffect, useMemo, useRef } from "react";
import { PostsPageLayout } from "src/components/PostsPageLayout";
import { VirtualizedPostList } from "src/components/VirtualizedPostList";
import { envClient } from "src/lib/env/client";
import { postsInfiniteQueryOptions } from "src/lib/posts/posts.queries";
import { postsSearchSchema } from "src/lib/posts/posts.schema";

export const Route = createFileRoute("/posts/")({
  component: PostsContent,
  ssr: "data-only",
  validateSearch: postsSearchSchema,
});

function PostsContent() {
  const { q, tags, sortBy, dateRange, page } = Route.useSearch();
  const pageSize = 50;

  // Store the initial page only on first render - don't update when URL changes
  const initialPageRef = useRef(Math.max(1, page));
  const initialPage = initialPageRef.current;
  const navigate = Route.useNavigate();
  const updateTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Reset initial page only when search parameters change (not page)
  const prevSearchRef = useRef({ dateRange, q, sortBy, tags });
  useEffect(() => {
    const prev = prevSearchRef.current;
    if (
      prev.q !== q ||
      prev.sortBy !== sortBy ||
      prev.dateRange !== dateRange ||
      JSON.stringify(prev.tags) !== JSON.stringify(tags)
    ) {
      initialPageRef.current = 1;
      prevSearchRef.current = { dateRange, q, sortBy, tags };
    }
  }, [q, tags, sortBy, dateRange]);

  const {
    data,
    fetchNextPage,
    fetchPreviousPage,
    hasNextPage,
    hasPreviousPage,
    isFetchingNextPage,
    isFetchingPreviousPage,
  } = useSuspenseInfiniteQuery(
    postsInfiniteQueryOptions(
      q,
      tags,
      sortBy,
      dateRange,
      initialPage,
      pageSize,
    ),
  );

  // Prefetch adjacent pages on mount for smoother scrolling
  const prefetchKey = `${q}-${tags.join(",")}-${sortBy}-${dateRange}-${initialPage}`;
  const lastPrefetchKeyRef = useRef<string | null>(null);

  useEffect(() => {
    // Skip if already prefetched for this configuration
    if (lastPrefetchKeyRef.current === prefetchKey) return;
    if (!data?.pages || data.pages.length === 0) return;

    // Mark as done for this config immediately
    lastPrefetchKeyRef.current = prefetchKey;

    const prefetchBuffer = async () => {
      await new Promise((resolve) => setTimeout(resolve, 100));

      const promises: Promise<unknown>[] = [];

      if (initialPage > 1 && hasPreviousPage) {
        promises.push(fetchPreviousPage());
      }
      if (hasNextPage) {
        promises.push(fetchNextPage());
      }

      await Promise.all(promises);
    };

    prefetchBuffer();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [prefetchKey, data?.pages?.length]);

  const allPosts = useMemo(() => {
    return data?.pages?.flatMap((page) => page.data) ?? [];
  }, [data?.pages]);

  const popularTags = data?.pages?.[0]?.meta?.popularTags ?? [];
  const totalCount = data?.pages?.[0]?.meta?.pagination?.total ?? 0;
  const totalPages = data?.pages?.[0]?.meta?.pagination?.totalPages ?? 0;

  // Calculate the first loaded page from the actual data
  const firstLoadedPage = useMemo(() => {
    if (!data?.pages || data.pages.length === 0) return initialPage;
    // The first page in the array has the lowest page number
    return Math.min(...data.pages.map((p) => p.meta.pagination.currentPage));
  }, [data?.pages, initialPage]);

  // Debounced page change to avoid spamming navigation
  const handlePageChange = useCallback(
    (newPage: number) => {
      if (newPage === page) return;

      if (updateTimeoutRef.current) {
        clearTimeout(updateTimeoutRef.current);
      }

      updateTimeoutRef.current = setTimeout(() => {
        if (newPage >= 1 && newPage <= totalPages) {
          navigate({
            replace: true,
            search: (prev) => ({
              ...prev,
              page: newPage,
            }),
          });
        }
      }, 150);
    },
    [page, totalPages, navigate],
  );

  useEffect(() => {
    return () => {
      if (updateTimeoutRef.current) {
        clearTimeout(updateTimeoutRef.current);
      }
    };
  }, []);

  return (
    <Box p={4} w="full">
      {envClient.MODE === "development" && (
        <VStack align="start" borderBottom="1px" p={4}>
          <Text fontSize="sm">Posts loaded: {allPosts.length}</Text>
          <Text fontSize="sm">Total posts: {totalCount}</Text>
          <Text fontSize="sm">Current page (URL): {page}</Text>
          <Text fontSize="sm">Initial page: {initialPage}</Text>
          <Text fontSize="sm">First loaded page: {firstLoadedPage}</Text>
          <Text fontSize="sm">Total pages: {totalPages}</Text>
          <Text fontSize="sm">Has next: {hasNextPage ? "Yes" : "No"}</Text>
          <Text fontSize="sm">Has prev: {hasPreviousPage ? "Yes" : "No"}</Text>
          <Text fontSize="sm">Pages in memory: {data?.pages?.length ?? 0}</Text>
        </VStack>
      )}
      <PostsPageLayout
        dateRange={dateRange}
        fromRoute="/posts"
        popularTags={popularTags}
        searchQuery={q}
        selectedTags={tags}
        sortBy={sortBy}
      >
        <GridItem>
          <Suspense
            fallback={
              <Stack align="center" justify="center" minH="600px">
                <Spinner size="lg" />
                <Text>Loading posts...</Text>
              </Stack>
            }
          >
            <VirtualizedPostList
              currentPage={page}
              firstLoadedPage={firstLoadedPage}
              hasNextPage={hasNextPage}
              hasPreviousPage={hasPreviousPage}
              isFetchingNextPage={isFetchingNextPage}
              isFetchingPreviousPage={isFetchingPreviousPage}
              onFetchNextPage={fetchNextPage}
              onFetchPreviousPage={fetchPreviousPage}
              onPageChange={handlePageChange}
              pageSize={pageSize}
              posts={allPosts}
              searchQuery={q}
              totalPages={totalPages}
            />
          </Suspense>
        </GridItem>
      </PostsPageLayout>
    </Box>
  );
}
