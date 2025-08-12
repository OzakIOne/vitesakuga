import { Outlet, createFileRoute } from "@tanstack/react-router";
import { fetchPosts, searchPosts } from "../utils/posts";
import { PostList } from "~/components/PostList";
import z from "zod";
import { useInfiniteQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useRef } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import { PostsSelect } from "~/auth/db/schema";
import React from "react";

const searchSchema = z.object({
  q: z.string().trim().min(1).optional(),
  "page[size]": z.coerce.number().min(1).max(100).default(20).optional(),
});

type PaginatedPostsResponse = {
  data: PostsSelect[];
  links: {
    self: string;
    first: string | null;
    last: string | null;
    prev: string | null;
    next: string | null;
  };
  meta: {
    hasMore: boolean;
    cursors: {
      before: number | null;
      after: number | null;
    };
  };
};

export const Route = createFileRoute("/posts")({
  validateSearch: searchSchema,
  loaderDeps: ({ search }) => ({
    q: search.q,
    size: search["page[size]"] || 20,
  }),
  loader: async ({ deps: { q, size } }) => {
    if (q) {
      return await searchPosts({
        data: {
          q,
          page: { size },
        },
      });
    }
    return await fetchPosts({
      data: {
        page: { size: 5 }, // Initial load with smaller size
      },
    });
  },
  component: PostsLayoutComponent,
  staleTime: 60 * 1000,
});

function PostsLayoutComponent() {
  const { q, size } = Route.useLoaderDeps();
  const fetchPostsFn = useServerFn(fetchPosts);
  const searchPostsFn = useServerFn(searchPosts);

  const {
    data,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    status,
    error,
  } = useInfiniteQuery<PaginatedPostsResponse, Error>({
    queryKey: ["posts", q],
    queryFn: async ({ pageParam }) => {
      const cursor = pageParam as number | undefined;

      if (q) {
        return searchPostsFn({
          data: {
            q,
            page: {
              size: 20,
              after: cursor,
            },
          },
        });
      }

      return fetchPostsFn({
        data: {
          page: {
            size: 20,
            after: cursor,
          },
        },
      });
    },
    getNextPageParam: (lastPage) => {
      // Use the cursor from meta for next page
      return lastPage?.meta?.hasMore
        ? lastPage?.meta?.cursors?.after
        : undefined;
    },
    initialPageParam: undefined,
    staleTime: 60 * 1000,
  });

  // Flatten posts from JSON:API structure
  const posts: PostsSelect[] = (data?.pages ?? []).flatMap(
    (page) => page?.data ?? []
  );

  // Check if there are more pages using meta.hasMore from the last page
  const lastPage = data?.pages?.slice(-1)[0];
  const hasMore = lastPage?.meta?.hasMore ?? false;

  const parentRef = useRef<HTMLDivElement>(null);

  // Calcul du nombre de colonnes basé sur la largeur de l'écran
  const getColumnsPerRow = () => {
    if (typeof window !== "undefined") {
      const width = window.innerWidth;
      if (width >= 1536) return 4; // 2xl
      if (width >= 1280) return 3; // xl
      if (width >= 1024) return 3; // lg
      if (width >= 768) return 2; // md
      return 1; // sm et xs
    }
    return 3; // par défaut côté serveur
  };
  const columnsPerRow = getColumnsPerRow();
  const totalRows = Math.ceil(posts.length / columnsPerRow);
  const totalCols = columnsPerRow;

  const rowVirtualizer = useVirtualizer({
    count: hasMore ? totalRows + 1 : totalRows,
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
      hasMore &&
      lastRow &&
      lastRow.index >= totalRows - 1 &&
      !isFetchingNextPage
    ) {
      fetchNextPage();
    }
  }, [hasMore, lastRow, totalRows, isFetchingNextPage, fetchNextPage]);

  if (status === "pending") {
    return (
      <div className="p-4 w-full">
        <div className="flex items-center justify-center h-64">
          <div className="text-lg text-gray-600">Chargement des posts...</div>
        </div>
      </div>
    );
  }

  if (status === "error") {
    return (
      <div className="p-4 w-full">
        <div className="flex items-center justify-center h-64">
          <div className="text-lg text-red-600">
            Erreur lors du chargement: {error?.message}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 w-full">
      {/* Debug info (remove in production) */}
      {process.env.NODE_ENV === "development" && (
        <div>
          <p>Posts chargés: {posts.length}</p>
          <p>A plus de pages: {hasMore ? "Oui" : "Non"}</p>
          <p>Cursor après: {lastPage?.meta?.cursors?.after || "N/A"}</p>
        </div>
      )}

      {/* Search info */}
      {q && (
        <div className="mb-4 p-3 bg-blue-50 rounded-lg">
          <p className="text-sm text-blue-700">
            Résultats de recherche pour: <strong>{q}</strong>
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
                  // Loader row
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
                        {hasMore && isFetchingNextPage && "Chargement..."}
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

      <div className="mt-4">
        <Outlet />
      </div>
    </div>
  );
}
