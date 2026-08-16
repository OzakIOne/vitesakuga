import { useVirtualizer } from "@tanstack/react-virtual";
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { PostCard } from "src/components/PostCard";
import { Spinner } from "src/components/ui/feedback";
import { Box, SimpleGrid, Stack } from "src/components/ui/layout";
import type { PostWithVotes } from "src/lib/db/schema";
import { envClient } from "src/lib/env/client";
import type { PostsSearchParams } from "src/lib/posts/posts.schema";
import { useResponsiveColumns } from "src/lib/posts/useResponsiveColumns";

const ROW_GAP = 16;
const PREVIOUS_BUFFER_ROWS = 2;
const NEXT_BUFFER_ROWS = 10;
const SCROLL_VIEWPORT = "calc(100dvh - 8rem)";

type VirtualPostsGridProps = {
  anchorPostIndex: number | null;
  anchorScrollKey: number;
  allPosts: readonly PostWithVotes[];
  fetchNextPage: () => void;
  fetchPreviousPage: () => void;
  hasNextPage: boolean;
  hasPreviousPage: boolean;
  isFetchingNextPage: boolean;
  isFetchingPreviousPage: boolean;
  pageParams: readonly number[];
  pageSize: number;
  searchParams: PostsSearchParams;
  syncPageToUrl: (page: number) => void;
};

export function VirtualPostsGrid({
  anchorPostIndex,
  anchorScrollKey,
  allPosts,
  fetchNextPage,
  fetchPreviousPage,
  hasNextPage,
  hasPreviousPage,
  isFetchingNextPage,
  isFetchingPreviousPage,
  pageParams,
  pageSize,
  searchParams,
  syncPageToUrl,
}: VirtualPostsGridProps) {
  const columns = useResponsiveColumns();
  const parentRef = useRef<HTMLDivElement>(null);
  const [containerWidth, setContainerWidth] = useState(0);

  const rows = useMemo(() => {
    const chunks: PostWithVotes[][] = [];
    for (let i = 0; i < allPosts.length; i += columns) {
      chunks.push(allPosts.slice(i, i + columns));
    }
    return chunks;
  }, [allPosts, columns]);

  const estimateSize = useCallback(() => {
    if (containerWidth <= 0) return 300;
    const columnWidth = (containerWidth - (columns - 1) * ROW_GAP) / columns;
    // 16/9 thumbnail + text block + row gap
    return Math.round(columnWidth * (9 / 16)) + 120 + ROW_GAP;
  }, [columns, containerWidth]);

  const virtualizer = useVirtualizer({
    count: rows.length,
    estimateSize,
    getItemKey: (index) => rows[index]?.[0]?.id ?? index,
    getScrollElement: () => parentRef.current,
    overscan: 4,
  });

  const virtualItems = virtualizer.getVirtualItems();

  useLayoutEffect(() => {
    const el = parentRef.current;
    if (!el) return;
    setContainerWidth(el.clientWidth);
  }, []);

  const anchoredKeyRef = useRef<number | null>(null);
  const [hasAnchored, setHasAnchored] = useState(false);
  const anchorRow = useMemo(
    () =>
      anchorPostIndex === null ? null : Math.floor(anchorPostIndex / columns),
    [anchorPostIndex, columns],
  );

  useEffect(() => {
    setHasAnchored(false);
    anchoredKeyRef.current = null;
  }, [anchorScrollKey]);

  useLayoutEffect(() => {
    if (anchorPostIndex === null || anchorRow === null) return;
    if (anchoredKeyRef.current === anchorScrollKey) return;
    anchoredKeyRef.current = anchorScrollKey;
    virtualizer.scrollToIndex(anchorRow, { align: "start" });
  }, [anchorPostIndex, anchorRow, anchorScrollKey, virtualizer]);

  // Only enable scroll-driven behaviour once the anchor position has actually
  // been reached, so the URL sync and edge-fetch triggers don't fire with the
  // pre-anchor visible page.
  useEffect(() => {
    if (anchorRow === null) return;
    const firstIndex = virtualItems[0]?.index ?? 0;
    if (firstIndex >= anchorRow) {
      setHasAnchored(true);
    }
  }, [anchorRow, virtualItems]);

  useEffect(() => {
    if (!hasAnchored) return;
    const lastItem = virtualItems[virtualItems.length - 1];
    if (
      lastItem &&
      lastItem.index >= rows.length - NEXT_BUFFER_ROWS &&
      hasNextPage &&
      !isFetchingNextPage
    ) {
      fetchNextPage();
    }
    const firstItem = virtualItems[0];
    if (
      firstItem &&
      firstItem.index <= PREVIOUS_BUFFER_ROWS &&
      hasPreviousPage &&
      !isFetchingPreviousPage
    ) {
      fetchPreviousPage();
    }
  }, [
    fetchNextPage,
    fetchPreviousPage,
    hasAnchored,
    hasNextPage,
    hasPreviousPage,
    isFetchingNextPage,
    isFetchingPreviousPage,
    rows.length,
    virtualItems,
  ]);

  const firstVisiblePage = useMemo(() => {
    const firstItem = virtualItems[0];
    const firstPageParam = pageParams[0];
    if (!firstItem || firstPageParam === undefined) return null;
    const firstPostIndex = firstItem.index * columns;
    return firstPageParam + Math.floor(firstPostIndex / pageSize);
  }, [columns, pageParams, pageSize, virtualItems]);

  const lastSyncedPageRef = useRef<number | null>(null);
  useEffect(() => {
    if (firstVisiblePage === null || !hasAnchored) return;
    if (firstVisiblePage === lastSyncedPageRef.current) return;
    lastSyncedPageRef.current = firstVisiblePage;
    syncPageToUrl(firstVisiblePage);
  }, [firstVisiblePage, hasAnchored, syncPageToUrl]);

  return (
    <Box w="full">
      {envClient.MODE === "development" && (
        <Stack align="start" borderBottom="1px" mb={4} p={2}>
          <Box fontSize="sm">Posts loaded: {allPosts.length}</Box>
          <Box fontSize="sm">Visible page: {firstVisiblePage ?? "n/a"}</Box>
        </Stack>
      )}

      <div
        ref={parentRef}
        style={{ height: SCROLL_VIEWPORT, overflowY: "auto" }}
      >
        {isFetchingPreviousPage && (
          <Stack align="center" justify="center" py={2}>
            <Spinner size="sm" />
          </Stack>
        )}

        <div
          style={{
            height: `${virtualizer.getTotalSize()}px`,
            position: "relative",
            width: "100%",
          }}
        >
          {virtualItems.map((virtualRow) => {
            const row = rows[virtualRow.index];
            if (!row) return null;
            return (
              <div
                key={virtualRow.key}
                data-index={virtualRow.index}
                ref={virtualizer.measureElement}
                style={{
                  left: 0,
                  paddingBottom: ROW_GAP,
                  position: "absolute",
                  top: 0,
                  transform: `translateY(${virtualRow.start}px)`,
                  width: "100%",
                }}
              >
                <SimpleGrid columns={columns} gap={4}>
                  {row.map((post) => (
                    <Box key={post.id}>
                      <PostCard post={post} searchParams={searchParams} />
                    </Box>
                  ))}
                </SimpleGrid>
              </div>
            );
          })}
        </div>

        {isFetchingNextPage && (
          <Stack align="center" justify="center" py={2}>
            <Spinner size="sm" />
          </Stack>
        )}
      </div>
    </Box>
  );
}
