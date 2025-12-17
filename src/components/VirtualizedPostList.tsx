import { Box, Flex } from "@chakra-ui/react";
import { useVirtualizer } from "@tanstack/react-virtual";
import { useEffect, useMemo, useRef, useState } from "react";
import type { DbSchemaInsert } from "src/lib/db/schema";
import { PostCard } from "./PostCard";

type VirtualizedPostListProps = {
  posts: DbSchemaInsert["posts"][];
  searchQuery?: string;
  pageSize?: number;
  hasNextPage?: boolean;
  isFetchingNextPage?: boolean;
  onFetchNextPage?: () => void;
};

export function VirtualizedPostList({
  posts,
  searchQuery,
  pageSize,
  hasNextPage = false,
  isFetchingNextPage = false,
  onFetchNextPage,
}: VirtualizedPostListProps) {
  const parentRef = useRef<HTMLDivElement>(null);
  const [containerWidth, setContainerWidth] = useState(0);

  // Update container width on resize
  useEffect(() => {
    const updateWidth = () => {
      if (parentRef.current) {
        setContainerWidth(parentRef.current.clientWidth);
      }
    };

    updateWidth();
    window.addEventListener("resize", updateWidth);
    return () => window.removeEventListener("resize", updateWidth);
  }, []);

  // Calculate columns based on container width with better breakpoints
  const columnsPerRow = useMemo(() => {
    if (containerWidth === 0) return 6;

    // Minimum card width: 280px, with 16px gap between cards
    const minCardWidth = 280;
    const gap = 16;

    // Calculate max columns that fit comfortably
    const maxColumns = Math.floor(
      (containerWidth + gap) / (minCardWidth + gap),
    );

    // Cap at 6 columns and ensure at least 1
    return Math.min(Math.max(1, maxColumns), 6);
  }, [containerWidth]);

  const totalRows = Math.ceil(posts.length / columnsPerRow);
  const totalCols = columnsPerRow;

  const rowVirtualizer = useVirtualizer({
    count: hasNextPage ? totalRows + 1 : totalRows,
    estimateSize: () => 240,
    getScrollElement: () => parentRef.current,
    overscan: 2,
  });

  const columnVirtualizer = useVirtualizer({
    count: totalCols,
    estimateSize: () =>
      Math.floor((containerWidth || window.innerWidth) / totalCols),
    getScrollElement: () => parentRef.current,
    horizontal: true,
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
      !isFetchingNextPage &&
      onFetchNextPage
    ) {
      onFetchNextPage();
    }
  }, [hasNextPage, lastRow, totalRows, isFetchingNextPage, onFetchNextPage]);

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
            No posts found
            {searchQuery && ` for query "${searchQuery}"`}
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
      <Box
        style={{
          height: `${rowVirtualizer.getTotalSize()}px`,
          position: "relative",
          width: "100%",
        }}
      >
        {virtualRows.map((virtualRow) => (
          <Flex
            h={`${virtualRow.size}px`}
            key={virtualRow.key}
            left={0}
            position="absolute"
            px={4}
            style={{
              boxSizing: "border-box",
              transform: `translateY(${virtualRow.start}px)`,
            }}
            top={0}
            w="full"
          >
            {virtualCols.map((virtualCol) => {
              const postIndex = virtualRow.index * totalCols + virtualCol.index;

              if (postIndex >= posts.length) {
                if (virtualRow.index >= totalRows) {
                  return (
                    <Flex
                      align="center"
                      justify="center"
                      key={virtualCol.key}
                      style={{
                        height: `${virtualRow.size}px`,
                        marginRight:
                          virtualCol.index < totalCols - 1 ? "16px" : "0",
                        width: `calc((100% - ${(totalCols - 1) * 16}px) / ${totalCols})`,
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
                  p={2}
                  rounded={4}
                  shadow={"md"}
                  style={{
                    height: `${virtualRow.size}px`,
                    marginRight:
                      virtualCol.index < totalCols - 1 ? "16px" : "0",
                    width: `calc((100% - ${(totalCols - 1) * 16}px) / ${totalCols})`,
                  }}
                >
                  <PostCard pageSize={pageSize} post={post} q={searchQuery} />
                </Box>
              );
            })}
          </Flex>
        ))}
      </Box>
    </Box>
  );
}
