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
import { createFileRoute, Link } from "@tanstack/react-router";
import { useVirtualizer } from "@tanstack/react-virtual";
import { useEffect, useMemo, useRef } from "react";
import { PostList } from "src/components/PostList";
import { SearchBox } from "src/components/SearchBox";
import { envClient } from "src/lib/env/client";
import { postsInfiniteQueryOptions } from "src/lib/posts/posts.queries";
import z from "zod";

const searchSchema = z.object({
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
  const { q, size } = Route.useLoaderDeps();

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

  const posts = data?.pages?.flatMap((page) => page.data) ?? [];

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
        <Text fontSize="lg">
          Error loading: {error?.message}
        </Text>
      </VStack>
    );
  }

  return (
    <Box w="full" p={4}>
      {envClient.MODE === "development" && (
        <VStack
          p={4}
          borderBottom="1px"
          align="start"
        >
          <Text fontSize="sm">Posts loaded: {posts.length}</Text>
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
              <Heading size="sm" mb={3}>
                Popular Tags
              </Heading>
              <Stack direction="row" flexWrap="wrap" gap={2}>
                <Link to="/posts/tags/$tag" params={{ tag: "sakuga" }}>
                  <Badge
                    px={2}
                    py={1}
                    borderRadius="full"
                    cursor="pointer"
                  >
                    sakuga
                  </Badge>
                </Link>
                <Link to="/posts/tags/$tag" params={{ tag: "animation" }}>
                  <Badge
                    px={2}
                    py={1}
                    borderRadius="full"
                    cursor="pointer"
                  >
                    animation
                  </Badge>
                </Link>
                <Link to="/posts/tags/$tag" params={{ tag: "effects" }}>
                  <Badge
                    px={2}
                    py={1}
                    borderRadius="full"
                    cursor="pointer"
                  >
                    effects
                  </Badge>
                </Link>
              </Stack>
            </Box>

            <Box p={4} borderRadius="md" shadow="md" border="1px">
              <Heading size="sm" mb={3}>
                Filters
              </Heading>
              <VStack align="stretch" gap={3}>
                <Box>
                  <Text fontSize="xs" fontWeight="bold" mb={1}>
                    Sort By
                  </Text>
                  <Stack direction="row" flexWrap="wrap" gap={2}>
                    <Badge
                      px={2}
                      py={1}
                      borderRadius="md"
                      cursor="pointer"
                    >
                      Latest
                    </Badge>
                    <Badge
                      variant="outline"
                      px={2}
                      py={1}
                      borderRadius="md"
                      cursor="pointer"
                    >
                      Popular
                    </Badge>
                    <Badge
                      variant="outline"
                      px={2}
                      py={1}
                      borderRadius="md"
                      cursor="pointer"
                    >
                      Oldest
                    </Badge>
                  </Stack>
                </Box>
                <Box>
                  <Text fontSize="xs" fontWeight="bold" mb={1}>
                    Date Range
                  </Text>
                  <Stack direction="row" flexWrap="wrap" gap={2}>
                    <Badge
                      variant="outline"
                      px={2}
                      py={1}
                      borderRadius="md"
                      cursor="pointer"
                    >
                      Today
                    </Badge>
                    <Badge
                      variant="outline"
                      px={2}
                      py={1}
                      borderRadius="md"
                      cursor="pointer"
                    >
                      This Week
                    </Badge>
                    <Badge
                      variant="outline"
                      px={2}
                      py={1}
                      borderRadius="md"
                      cursor="pointer"
                    >
                      This Month
                    </Badge>
                  </Stack>
                </Box>
              </VStack>
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
