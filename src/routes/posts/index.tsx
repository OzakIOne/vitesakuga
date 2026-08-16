import { createFileRoute } from "@tanstack/react-router";
import { PostsPageLayout } from "src/components/PostsPageLayout";
import { Box } from "src/components/ui/layout";
import { VirtualPostsGrid } from "src/components/VirtualPostsGrid";
import { toStandardSchemaV1Strict } from "src/lib/effect/schema.utils";
import { usePostsInfiniteScroll } from "src/lib/posts/posts.hooks";
import { searchPostsBaseSchema } from "src/lib/posts/posts.schema";

export const Route = createFileRoute("/posts/")({
  component: PostsContent,
  validateSearch: toStandardSchemaV1Strict(searchPostsBaseSchema),
  ssr: "data-only",
});

function PostsContent() {
  const searchParams = Route.useSearch();
  const { q, tags, sortBy, dateRange } = searchParams;

  const {
    allPosts,
    anchorPostIndex,
    anchorScrollKey,
    fetchNextPage,
    fetchPreviousPage,
    hasNextPage,
    hasPreviousPage,
    isFetchingNextPage,
    isFetchingPreviousPage,
    pageParams,
    pageSize,
    popularTags,
    syncPageToUrl,
  } = usePostsInfiniteScroll(searchParams);

  return (
    <Box p={4} w="full">
      <PostsPageLayout
        dateRange={dateRange}
        fromRoute="/posts/"
        popularTags={popularTags}
        searchQuery={q}
        selectedTags={tags}
        sortBy={sortBy}
      >
        <VirtualPostsGrid
          allPosts={allPosts}
          anchorPostIndex={anchorPostIndex}
          anchorScrollKey={anchorScrollKey}
          fetchNextPage={fetchNextPage}
          fetchPreviousPage={fetchPreviousPage}
          hasNextPage={hasNextPage}
          hasPreviousPage={hasPreviousPage}
          isFetchingNextPage={isFetchingNextPage}
          isFetchingPreviousPage={isFetchingPreviousPage}
          pageParams={pageParams}
          pageSize={pageSize}
          searchParams={searchParams}
          syncPageToUrl={syncPageToUrl}
        />
      </PostsPageLayout>
    </Box>
  );
}
