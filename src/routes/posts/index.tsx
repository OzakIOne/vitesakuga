import { useInfiniteQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { useVirtualizer } from "@tanstack/react-virtual";
import React, { useEffect, useMemo, useRef } from "react";
import { PostList } from "src/components/PostList";
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
      if (width >= 1536) return 4;
      if (width >= 1280) return 3;
      if (width >= 1024) return 3;
      if (width >= 768) return 2;
      return 1;
    }
    return 3;
  }, []);
  const totalRows = Math.ceil(posts.length / columnsPerRow);
  const totalCols = columnsPerRow;

  const rowVirtualizer = useVirtualizer({
    count: hasNextPage ? totalRows + 1 : totalRows,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 280,
    overscan: 2,
  });

  const columnVirtualizer = useVirtualizer({
    horizontal: true,
    count: totalCols,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 300,
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

  if (status === "pending") {
    return (
      <div className="p-4 w-full">
        <div className="flex items-center justify-center h-64">
          <div className="text-lg text-gray-600">Loading posts...</div>
        </div>
      </div>
    );
  }

  if (status === "error") {
    return (
      <div className="p-4 w-full">
        <div className="flex items-center justify-center h-64">
          <div className="text-lg text-red-600">
            Error loading: {error?.message}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 w-full">
      {envClient.MODE === "development" && (
        <div>
          <p>Posts loaded: {posts.length}</p>
          <p>Has next page: {hasNextPage ? "Yes" : "No"}</p>
          <p>
            Last cursor:{" "}
            {data?.pages?.[data.pages.length - 1]?.meta?.cursors?.after ||
              "N/A"}
          </p>
        </div>
      )}

      {q && (
        <div className="mb-4 p-3 bg-blue-50 rounded-lg">
          <p className="text-sm text-blue-700">
            Search results for: <strong>{q}</strong>
          </p>
        </div>
      )}

      <div
        ref={parentRef}
        className="overflow-auto h-[85vh] w-full"
        style={{ position: "relative" }}
      >
        <div
          style={{
            height: `${rowVirtualizer.getTotalSize()}px`,
            width: `${columnVirtualizer.getTotalSize()}px`,
            position: "relative",
          }}
        >
          {virtualRows.map((virtualRow) => (
            <React.Fragment key={virtualRow.key}>
              {virtualCols.map((virtualCol) => {
                const postIndex =
                  virtualRow.index * totalCols + virtualCol.index;

                if (postIndex >= posts.length) {
                  if (virtualRow.index >= totalRows) {
                    return (
                      <div
                        key={virtualCol.key}
                        className="absolute flex items-center justify-center w-full text-gray-600"
                        style={{
                          top: 0,
                          left: 0,
                          width: `${virtualCol.size}px`,
                          height: `${virtualRow.size}px`,
                          transform: `translateX(${virtualCol.start}px) translateY(${virtualRow.start}px)`,
                        }}
                      >
                        {hasNextPage && isFetchingNextPage && "Loading..."}
                      </div>
                    );
                  }
                  return null;
                }

                const post = posts[postIndex];
                return (
                  <div
                    key={`${virtualRow.key}-${virtualCol.key}`}
                    style={{
                      position: "absolute",
                      top: 0,
                      left: 0,
                      width: `${virtualCol.size}px`,
                      height: `${virtualRow.size}px`,
                      transform: `translateX(${virtualCol.start}px) translateY(${virtualRow.start}px)`,
                    }}
                  >
                    <PostList post={post} q={q} pageSize={size} />
                  </div>
                );
              })}
            </React.Fragment>
          ))}
        </div>
      </div>
    </div>
  );
}
