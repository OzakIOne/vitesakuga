import { Outlet, createFileRoute } from "@tanstack/react-router";
import { fetchPosts, searchPosts } from "../utils/posts";
import { PostList } from "~/components/PostList";
import z from "zod";
import { useInfiniteQuery, InfiniteData } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useRef } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import { PostsSelect } from "~/auth/db/schema";

const searchSchema = z.object({
  q: z.string().trim().min(1).optional(),
  "page[size]": z.coerce.number().min(1).max(100).default(20).optional(),
});

// Updated type to match JSON:API structure
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
  });

  // Flatten posts from JSON:API structure
  const posts: PostsSelect[] = (
    (data as InfiniteData<PaginatedPostsResponse>)?.pages ?? []
  ).flatMap((page) => page?.data ?? []);

  // Check if there are more pages using meta.hasMore from the last page
  const lastPage = (data as InfiniteData<PaginatedPostsResponse>)?.pages?.slice(
    -1
  )[0];
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
  const rowCount = Math.ceil(posts.length / columnsPerRow);
  const totalRows = hasMore ? rowCount + 1 : rowCount;

  const rowVirtualizer = useVirtualizer({
    count: totalRows,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 280,
    overscan: 2,
  });

  // Auto-fetch next page when virtual row is visible
  const virtualItems = rowVirtualizer.getVirtualItems();
  const lastItem = virtualItems[virtualItems.length - 1];
  if (
    hasMore &&
    lastItem &&
    lastItem.index >= rowCount - 1 &&
    !isFetchingNextPage
  ) {
    fetchNextPage();
  }

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
            width: "100%",
            position: "relative",
          }}
        >
          {rowVirtualizer.getVirtualItems().map((virtualRow) => {
            const isLoaderRow = virtualRow.index >= rowCount;

            if (isLoaderRow) {
              return (
                <div
                  key={virtualRow.key}
                  ref={rowVirtualizer.measureElement}
                  className="absolute left-0 w-full flex items-center justify-center py-8"
                  style={{
                    top: 0,
                    transform: `translateY(${virtualRow.start}px)`,
                    height: `${virtualRow.size}px`,
                  }}
                >
                  {hasMore && isFetchingNextPage && (
                    <div className="text-lg text-gray-600">
                      Chargement de plus de posts...
                    </div>
                  )}
                </div>
              );
            }

            // Calculer les posts pour cette ligne
            const startIndex = virtualRow.index * columnsPerRow;
            const endIndex = Math.min(startIndex + columnsPerRow, posts.length);
            const rowPosts = posts.slice(startIndex, endIndex);

            return (
              <div
                key={virtualRow.key}
                ref={rowVirtualizer.measureElement}
                className="absolute left-0 w-full px-4"
                style={{
                  top: 0,
                  transform: `translateY(${virtualRow.start}px)`,
                  minHeight: `${virtualRow.size}px`,
                }}
              >
                <div className="flex flex-wrap gap-4 w-full">
                  {rowPosts.map((post) => (
                    <div
                      key={post.id}
                      className={`
                        flex-1 min-w-0
                        ${columnsPerRow === 1 ? "basis-full" : ""}
                        ${columnsPerRow === 2 ? "basis-[calc(50%-0.5rem)]" : ""}
                        ${
                          columnsPerRow === 3
                            ? "basis-[calc(33.333%-0.75rem)]"
                            : ""
                        }
                        ${
                          columnsPerRow === 4 ? "basis-[calc(25%-0.75rem)]" : ""
                        }
                      `}
                    >
                      <PostList post={post} q={q} pageSize={size} />
                    </div>
                  ))}

                  {/* Remplir les espaces vides dans la dernière ligne si nécessaire */}
                  {rowPosts.length < columnsPerRow &&
                    Array.from({ length: columnsPerRow - rowPosts.length }).map(
                      (_, index) => (
                        <div
                          key={`empty-${index}`}
                          className={`
                          flex-1 min-w-0
                          ${
                            columnsPerRow === 2
                              ? "basis-[calc(50%-0.5rem)]"
                              : ""
                          }
                          ${
                            columnsPerRow === 3
                              ? "basis-[calc(33.333%-0.75rem)]"
                              : ""
                          }
                          ${
                            columnsPerRow === 4
                              ? "basis-[calc(25%-0.75rem)]"
                              : ""
                          }
                        `}
                        />
                      )
                    )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Debug info (remove in production) */}
      {process.env.NODE_ENV === "development" && (
        <div className="mt-4 p-3 bg-gray-100 rounded text-xs">
          <p>Posts chargés: {posts.length}</p>
          <p>A plus de pages: {hasMore ? "Oui" : "Non"}</p>
          <p>Cursor après: {lastPage?.meta?.cursors?.after || "N/A"}</p>
        </div>
      )}

      {/* Outlet pour les routes imbriquées */}
      <div className="mt-4">
        <Outlet />
      </div>
    </div>
  );
}
