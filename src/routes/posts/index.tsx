import {
  Badge,
  Box,
  Flex,
  Grid,
  GridItem,
  Heading,
  Stack,
  Text,
  VStack,
} from "@chakra-ui/react";
import { useInfiniteQuery } from "@tanstack/react-query";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useVirtualizer } from "@tanstack/react-virtual";
import { useEffect, useMemo, useRef } from "react";
import { PopularTagsSection } from "src/components/PopularTagsSection";
import { PostFilters } from "src/components/PostFilters";
import { PostList } from "src/components/PostList";
import { PostsPageLayout } from "src/components/PostsPageLayout";
import { SearchBox } from "src/components/SearchBox";
import { envClient } from "src/lib/env/client";
import { postsInfiniteQueryOptions } from "src/lib/posts/posts.queries";
import { postsFilterSearchSchema } from "src/lib/posts/posts.schema";
import { filterAndSortPosts } from "src/lib/posts/posts.utils";
import z from "zod";

const searchSchema = postsFilterSearchSchema.extend({
  q: z.string().trim().min(1).optional(),
  size: z.coerce.number().min(1).max(100).default(20).optional(),
});

export const Route = createFileRoute("/posts/")({
  validateSearch: searchSchema,
  loaderDeps: ({ search }) => ({
    q: search.q,
    size: search.size || 20,
  }),
  loader: async ({ context, deps: { q } }) => {
    if (q)
      await context.queryClient.ensureInfiniteQueryData(
        postsInfiniteQueryOptions(q),
      );
    else
      await context.queryClient.ensureInfiniteQueryData(
        postsInfiniteQueryOptions(),
      );
  },
  component: PostsLayoutComponent,
});

function PostsLayoutComponent() {
  const navigate = useNavigate({ from: Route.fullPath });
  const {
    q,
    size,
    sortBy: urlSortBy,
    dateRange: urlDateRange,
  } = Route.useSearch();

  const sortBy = urlSortBy || "latest";
  const dateRange = urlDateRange || "all";

  const {
    data,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    status,
    error,
  } = useInfiniteQuery({
    ...postsInfiniteQueryOptions(q),
  });

  const allPosts = data?.pages?.flatMap((page) => page.data) ?? [];

  const popularTags = data?.pages?.[0]?.meta?.popularTags ?? [];

  const filteredPosts = useMemo(() => {
    return filterAndSortPosts(allPosts, { sortBy, dateRange });
  }, [allPosts, sortBy, dateRange]);

  const posts = filteredPosts;

  const parentRef = useRef<HTMLDivElement>(null);

  const columnsPerRow = useMemo(() => {
    if (typeof window !== "undefined") {
      const width = window.innerWidth;
      if (width >= 1920) return 6;
      if (width >= 1536) return 5;
      if (width >= 1280) return 4;
      if (width >= 1024) return 3;
      if (width >= 768) return 2;
      return 1;
    }
    return 6;
  }, []);
  const totalRows = Math.ceil(posts.length / columnsPerRow);
  const totalCols = columnsPerRow;

  const rowVirtualizer = useVirtualizer({
    count: hasNextPage ? totalRows + 1 : totalRows,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 240,
    overscan: 2,
  });

  const columnVirtualizer = useVirtualizer({
    horizontal: true,
    count: totalCols,
    getScrollElement: () => parentRef.current,
    estimateSize: () => Math.floor(window.innerWidth / totalCols),
    overscan: 1,
  });

  const virtualRows = rowVirtualizer.getVirtualItems();
  const virtualCols = columnVirtualizer.getVirtualItems();

  const lastRow = virtualRows[virtualRows.length - 1];
  useEffect(() => {
    if (
      hasNextPage &&
      lastRow &&
      lastRow.index >= totalRows - 1 &&
      !isFetchingNextPage
    ) {
      fetchNextPage();
    }
  }, [hasNextPage, lastRow, totalRows, isFetchingNextPage, fetchNextPage]);

  if (status === "error") {
    return (
      <VStack w="full" p={4} justify="center" h="64">
        <Text fontSize="lg">Error loading: {error?.message}</Text>
      </VStack>
    );
  }

  return (
    <Box w="full" p={4}>
      {envClient.MODE === "development" && (
        <VStack p={4} borderBottom="1px" align="start">
          <Text fontSize="sm">Posts loaded: {allPosts.length}</Text>
          <Text fontSize="sm">Filtered posts: {posts.length}</Text>
          <Text fontSize="sm">Has next page: {hasNextPage ? "Yes" : "No"}</Text>
          <Text fontSize="sm">
            Last cursor:{" "}
            {data?.pages?.[data.pages.length - 1]?.meta?.cursors?.after ||
              "N/A"}
          </Text>
        </VStack>
      )}

      <Grid templateColumns={{ base: "1fr", lg: "1fr 3fr" }} gap={6} w="full">
        <GridItem>
          <VStack gap={4} align="stretch">
            <Box p={4} borderRadius="md" shadow="md" border="1px">
              <SearchBox defaultValue={q} />
            </Box>

            <Box p={4} borderRadius="md" shadow="md" border="1px">
              <PopularTagsSection tags={popularTags} />
            </Box>

            <Box p={4} borderRadius="md" shadow="md" border="1px">
              <Heading size="sm" mb={3}>
                Filters
              </Heading>
              <PostFilters sortBy={sortBy} dateRange={dateRange} />
            </Box>
          </VStack>
        </GridItem>

        <GridItem>
          <Box
            ref={parentRef}
            overflow="auto"
            h="calc(100vh - 120px)"
            w="full"
            position="relative"
            borderRadius="md"
            shadow="md"
            border="1px"
          >
            <Box
              style={{
                height: `${rowVirtualizer.getTotalSize()}px`,
                width: "100%",
                position: "relative",
              }}
            >
              {virtualRows.map((virtualRow) => (
                <Flex
                  key={virtualRow.key}
                  px={4}
                  position="absolute"
                  top={0}
                  left={0}
                  w="full"
                  h={`${virtualRow.size}px`}
                  style={{
                    transform: `translateY(${virtualRow.start}px)`,
                    boxSizing: "border-box",
                  }}
                >
                  {virtualCols.map((virtualCol) => {
                    const postIndex =
                      virtualRow.index * totalCols + virtualCol.index;

                    if (postIndex >= posts.length) {
                      if (virtualRow.index >= totalRows) {
                        return (
                          <Flex
                            key={virtualCol.key}
                            align="center"
                            justify="center"
                            style={{
                              width: `calc((100% - ${
                                (totalCols - 1) * 16
                              }px) / ${totalCols})`,
                              height: `${virtualRow.size}px`,
                              marginRight:
                                virtualCol.index < totalCols - 1 ? "16px" : "0",
                            }}
                          >
                            {hasNextPage && isFetchingNextPage && "Loading..."}
                          </Flex>
                        );
                      }
                      return null;
                    }

                    const post = posts[postIndex];
                    return (
                      <Box
                        key={`${virtualRow.key}-${virtualCol.key}`}
                        style={{
                          width: `calc((100% - ${
                            (totalCols - 1) * 16
                          }px) / ${totalCols})`,
                          height: `${virtualRow.size}px`,
                          marginRight:
                            virtualCol.index < totalCols - 1 ? "16px" : "0",
                        }}
                      >
                        <PostList post={post} q={q} pageSize={size} />
                      </Box>
                    );
                  })}
                </Flex>
              ))}
            </Box>
          </Box>
        </GridItem>
      </Grid>
    </Box>
  );
}
