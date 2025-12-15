import { Box, Flex } from "@chakra-ui/react";
import { useVirtualizer } from "@tanstack/react-virtual";
import { useEffect, useMemo, useRef } from "react";
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
      !isFetchingNextPage &&
      onFetchNextPage
    ) {
      onFetchNextPage();
    }
  }, [hasNextPage, lastRow, totalRows, isFetchingNextPage, onFetchNextPage]);

  if (posts.length === 0) {
    return (
      <Box
        ref={parentRef}
        overflow="auto"
        h="calc(100vh - 120px)"
        w="full"
        position="relative"
        borderRadius="md"
        shadow="md"
        border="1px"
        display="flex"
        alignItems="center"
        justifyContent="center"
      >
        <Box textAlign="center">
          <Box fontSize="lg" fontWeight="medium" color="gray.600">
            No posts found
            {searchQuery && ` for query "${searchQuery}"`}
          </Box>
          <Box fontSize="sm" color="gray.500" mt={2}>
            Try adjusting your search or filters
          </Box>
        </Box>
      </Box>
    );
  }

  return (
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
              const postIndex = virtualRow.index * totalCols + virtualCol.index;

              if (postIndex >= posts.length) {
                if (virtualRow.index >= totalRows) {
                  return (
                    <Flex
                      key={virtualCol.key}
                      align="center"
                      justify="center"
                      style={{
                        width: `calc((100% - ${(totalCols - 1) * 16}px) / ${totalCols})`,
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
                    width: `calc((100% - ${(totalCols - 1) * 16}px) / ${totalCols})`,
                    height: `${virtualRow.size}px`,
                    marginRight:
                      virtualCol.index < totalCols - 1 ? "16px" : "0",
                  }}
                >
                  <PostCard post={post} q={searchQuery} pageSize={pageSize} />
                </Box>
              );
            })}
          </Flex>
        ))}
      </Box>
    </Box>
  );
}
