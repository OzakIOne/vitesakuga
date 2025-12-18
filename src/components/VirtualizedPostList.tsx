import { Box, SimpleGrid, Text } from "@chakra-ui/react";
import { useVirtualizer } from "@tanstack/react-virtual";
import { useEffect, useMemo, useRef, useState } from "react";
import type { DbSchemaInsert } from "src/lib/db/schema";
import { PostCard } from "./PostCard";

const FETCH_PREVIOUS_THRESHOLD = 2;
const FETCH_NEXT_THRESHOLD = 3;

const getColumnsPerRow = (width: number): number => {
  if (width >= 1536) return 6;
  if (width >= 1280) return 5;
  if (width >= 1024) return 4;
  if (width >= 768) return 3;
  if (width >= 640) return 2;
  return 1;
};

type VirtualizedPostListProps = {
  posts: DbSchemaInsert["posts"][];
  searchQuery?: string;
  pageSize: number;
  currentPage: number;
  totalPages: number;
  hasNextPage?: boolean;
  isFetchingNextPage?: boolean;
  onFetchNextPage?: () => void;
  hasPreviousPage?: boolean;
  isFetchingPreviousPage?: boolean;
  onFetchPreviousPage?: () => void;
  onPageChange?: (page: number) => void;
  firstLoadedPage: number;
  estimatedRowHeight?: number;
};

export const VirtualizedPostList = ({
  posts,
  searchQuery,
  pageSize,
  currentPage,
  totalPages,
  hasNextPage = false,
  hasPreviousPage = false,
  isFetchingNextPage = false,
  isFetchingPreviousPage = false,
  onFetchNextPage,
  onFetchPreviousPage,
  onPageChange,
  firstLoadedPage,
  estimatedRowHeight = 240,
}: VirtualizedPostListProps) => {
  const parentRef = useRef<HTMLDivElement>(null);
  const lastReportedPageRef = useRef<number>(currentPage);
  const isInitialMountRef = useRef(true);
  const [containerWidth, setContainerWidth] = useState(0);

  // Track if component is ready for scroll-based fetching
  // This prevents fetching on initial render but allows it after a short delay
  const [isReadyForScrollFetch, setIsReadyForScrollFetch] = useState(false);

  useEffect(() => {
    const updateWidth = () => {
      if (parentRef.current) setContainerWidth(parentRef.current.clientWidth);
    };
    updateWidth();
    const resizeObserver = new ResizeObserver(updateWidth);
    if (parentRef.current) resizeObserver.observe(parentRef.current);
    return () => resizeObserver.disconnect();
  }, []);

  // Enable scroll-based fetching after initial render settles
  useEffect(() => {
    const timer = setTimeout(() => {
      setIsReadyForScrollFetch(true);
    }, 500); // Wait for prefetch to complete

    return () => clearTimeout(timer);
  }, []);

  const columnsPerRow = useMemo(() => {
    return containerWidth > 0 ? getColumnsPerRow(containerWidth) : 6;
  }, [containerWidth]);

  const totalRows = Math.ceil(posts.length / columnsPerRow);

  const rowVirtualizer = useVirtualizer({
    count: hasNextPage ? totalRows + 1 : totalRows,
    estimateSize: () => estimatedRowHeight,
    getScrollElement: () => parentRef.current,
    overscan: 3,
  });

  const virtualRows = rowVirtualizer.getVirtualItems();
  const firstRow = virtualRows[0];
  const lastRow = virtualRows[virtualRows.length - 1];

  // 🟢 Fetch previous page when at top
  useEffect(() => {
    if (!isReadyForScrollFetch) return;

    if (
      hasPreviousPage &&
      !isFetchingPreviousPage &&
      firstRow &&
      firstRow.index <= FETCH_PREVIOUS_THRESHOLD
    ) {
      if (!parentRef.current) return;

      // mémorise la hauteur avant prepend
      const prevTotalSize = rowVirtualizer.getTotalSize();

      onFetchPreviousPage?.();

      requestAnimationFrame(() => {
        if (!parentRef.current) return;
        const newTotalSize = rowVirtualizer.getTotalSize();
        const delta = newTotalSize - prevTotalSize;
        parentRef.current.scrollBy(0, delta);
      });
    }
  }, [
    isReadyForScrollFetch,
    firstRow?.index,
    hasPreviousPage,
    isFetchingPreviousPage,
    onFetchPreviousPage,
    rowVirtualizer,
  ]);

  // 🟢 Fetch next page when at bottom
  useEffect(() => {
    if (!isReadyForScrollFetch) return;

    if (
      hasNextPage &&
      !isFetchingNextPage &&
      lastRow &&
      lastRow.index >= totalRows - FETCH_NEXT_THRESHOLD
    ) {
      onFetchNextPage?.();
    }
  }, [
    isReadyForScrollFetch,
    lastRow?.index,
    totalRows,
    hasNextPage,
    isFetchingNextPage,
    onFetchNextPage,
  ]);

  // 🟢 Update URL based on scroll
  useEffect(() => {
    // Skip URL update on initial mount to prevent loop
    if (isInitialMountRef.current) {
      isInitialMountRef.current = false;
      return;
    }

    if (
      !firstRow ||
      !onPageChange ||
      columnsPerRow === 0 ||
      isFetchingNextPage ||
      isFetchingPreviousPage
    )
      return;

    const firstVisiblePostIndex = firstRow.index * columnsPerRow;
    const actualPostIndex =
      (firstLoadedPage - 1) * pageSize + firstVisiblePostIndex;
    const visiblePage = Math.floor(actualPostIndex / pageSize) + 1;

    if (
      visiblePage !== lastReportedPageRef.current &&
      visiblePage >= 1 &&
      visiblePage <= totalPages
    ) {
      lastReportedPageRef.current = visiblePage;
      onPageChange(visiblePage);
    }
  }, [
    firstRow?.index,
    columnsPerRow,
    pageSize,
    totalPages,
    onPageChange,
    firstLoadedPage,
    isFetchingNextPage,
    isFetchingPreviousPage,
  ]);

  // Reset state when search parameters change
  useEffect(() => {
    isInitialMountRef.current = true;
    setIsReadyForScrollFetch(false);
    const timer = setTimeout(() => {
      setIsReadyForScrollFetch(true);
    }, 500);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  if (posts.length === 0) {
    return (
      <Box
        alignItems="center"
        border="1px"
        borderRadius="md"
        display="flex"
        h="calc(100vh - 120px)"
        justifyContent="center"
        overflow="auto"
        position="relative"
        ref={parentRef}
        shadow="md"
        w="full"
      >
        <Box textAlign="center">
          <Box color="gray.600" fontSize="lg" fontWeight="medium">
            No posts found{searchQuery && ` for query "${searchQuery}"`}
          </Box>
          <Box color="gray.500" fontSize="sm" mt={2}>
            Try adjusting your search or filters
          </Box>
        </Box>
      </Box>
    );
  }

  return (
    <Box
      borderRadius="md"
      h="calc(100vh - 120px)"
      overflow="auto"
      position="relative"
      ref={parentRef}
      w="full"
    >
      {/* top loader */}
      {hasPreviousPage && isFetchingPreviousPage && (
        <Box
          bg="rgba(255,255,255,0.9)"
          left={0}
          p={2}
          position="absolute"
          right={0}
          textAlign="center"
          top={0}
          zIndex={10}
        >
          <Text color="gray.600" fontSize="sm">
            Loading previous posts...
          </Text>
        </Box>
      )}

      <Box
        style={{
          height: `${rowVirtualizer.getTotalSize()}px`,
          position: "relative",
          width: "100%",
        }}
      >
        {virtualRows.map((virtualRow) => {
          const startIndex = virtualRow.index * columnsPerRow;
          const endIndex = Math.min(startIndex + columnsPerRow, posts.length);
          const rowPosts = posts.slice(startIndex, endIndex);

          const isLoaderRow = virtualRow.index >= totalRows;

          return (
            <Box
              h={`${virtualRow.size}px`}
              key={virtualRow.key}
              left={0}
              position="absolute"
              style={{
                transform: `translateY(${virtualRow.start}px)`,
              }}
              top={0}
              w="full"
            >
              {isLoaderRow ? (
                <Box textAlign="center">
                  {hasNextPage ? "Loading more..." : "Nothing more to load"}
                </Box>
              ) : (
                <SimpleGrid
                  columns={{ "2xl": 6, base: 1, lg: 4, md: 3, sm: 2, xl: 5 }}
                  gap={4}
                  h="full"
                  px={4}
                >
                  {rowPosts.map((post) => (
                    <Box h="full" key={post.id} p={2} rounded={4} shadow="md">
                      <PostCard
                        pageSize={pageSize}
                        post={post}
                        q={searchQuery}
                      />
                    </Box>
                  ))}
                </SimpleGrid>
              )}
            </Box>
          );
        })}
      </Box>

      {/* bottom loader */}
      {hasNextPage && isFetchingNextPage && (
        <Box
          bg="rgba(255,255,255,0.9)"
          bottom={0}
          left={0}
          p={2}
          position="absolute"
          right={0}
          textAlign="center"
          zIndex={10}
        >
          <Text color="gray.600" fontSize="sm">
            Loading more posts...
          </Text>
        </Box>
      )}
    </Box>
  );
};
