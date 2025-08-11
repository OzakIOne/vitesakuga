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
});

type FetchPostsResult = {
  items: PostsSelect[];
  nextCursor?: number;
};

export const Route = createFileRoute("/posts")({
  validateSearch: searchSchema,
  loaderDeps: ({ search: { q } }) => ({ q }),
  loader: async ({ deps: { q } }) => {
    if (q) {
      return await searchPosts({ data: q });
    }
    return await fetchPosts({ data: { limit: 20 } }); // initial load with just limit
  },
  component: PostsLayoutComponent,
  staleTime: 60 * 1000,
});

function PostsLayoutComponent() {
  const fetchPostsFn = useServerFn(fetchPosts);
  const {
    data,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    status,
    error,
  } = useInfiniteQuery<FetchPostsResult, Error>({
    queryKey: ["posts"],
    queryFn: async ({ pageParam }) => {
      // pageParam is unknown, so cast to number | undefined
      return fetchPostsFn({
        data: { limit: 20, cursor: pageParam as number | undefined },
      });
    },
    getNextPageParam: (lastPage) => lastPage?.nextCursor,
    initialPageParam: undefined,
  });

  // Flatten posts
  const posts: PostsSelect[] = (
    (data as InfiniteData<FetchPostsResult>)?.pages ?? []
  ).flatMap((page) => page?.items ?? []);

  // Virtualization setup
  const parentRef = useRef<HTMLDivElement>(null);
  const rowVirtualizer = useVirtualizer({
    count: hasNextPage ? posts.length + 1 : posts.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 120,
    overscan: 5,
  });

  // Auto-fetch next page when virtual row is visible
  const virtualItems = rowVirtualizer.getVirtualItems();
  const lastItem = virtualItems[virtualItems.length - 1];
  if (
    hasNextPage &&
    lastItem &&
    lastItem.index === posts.length &&
    !isFetchingNextPage
  ) {
    fetchNextPage();
  }

  return (
    <div className="p-2 flex gap-2">
      <div
        ref={parentRef}
        className="flex flex-col overflow-auto h-[80vh] w-full max-w-2xl border rounded"
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
            const isLoaderRow = virtualRow.index === posts.length;
            return (
              <div
                key={virtualRow.key}
                ref={rowVirtualizer.measureElement}
                className="absolute left-0 w-full"
                style={{
                  top: 0,
                  transform: `translateY(${virtualRow.start}px)`,
                  height: `${virtualRow.size}px`,
                }}
              >
                {isLoaderRow ? (
                  hasNextPage ? (
                    <div className="flex items-center justify-center py-4">
                      Loading more...
                    </div>
                  ) : null
                ) : (
                  <PostList
                    key={posts[virtualRow.index]?.id}
                    post={posts[virtualRow.index]}
                  />
                )}
              </div>
            );
          })}
        </div>
      </div>
      <hr />
      <Outlet />
    </div>
  );
}
