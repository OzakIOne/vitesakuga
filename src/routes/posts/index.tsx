import { createFileRoute } from "@tanstack/react-router";
import { PostsPageLayout } from "src/components/PostsPageLayout";
import { PostsResultsState } from "src/components/PostsResultsState";
import { Box } from "src/components/ui/layout";
import { Heading } from "src/components/ui/typography";
import { VirtualPostsGrid } from "src/components/VirtualPostsGrid";
import { toStandardSchemaV1Strict } from "src/lib/effect/schema.utils";
import { usePostsInfiniteScroll } from "src/lib/posts/posts.hooks";
import { postsInfiniteQueryOptions } from "src/lib/posts/posts.queries";
import { searchPostsBaseSchema } from "src/lib/posts/posts.schema";

export const Route = createFileRoute("/posts/")({
  component: PostsContent,
  validateSearch: toStandardSchemaV1Strict(searchPostsBaseSchema),
  ssr: "data-only",
});

function PostsContent() {
  const searchParams = Route.useSearch();
  const { dateRange, q, seriesTitle, sortBy, tags, view } = searchParams;
  const navigate = Route.useNavigate();

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
    retry,
    syncPageToUrl,
    error,
    isPending,
    firstPage,
  } = usePostsInfiniteScroll(
    "/posts/",
    postsInfiniteQueryOptions(searchParams),
  );

  const activeFilters = [
    ...(q ? [`Search: ${q}`] : []),
    ...tags.map((tag) => `Tag: ${tag}`),
    ...(dateRange !== "all" ? [`Date: ${dateRange}`] : []),
    ...(sortBy !== "newest" ? [`Sort: ${sortBy}`] : []),
    ...(view !== "chronological" ? [`View: ${view}`] : []),
    ...(seriesTitle ? [`Series: ${seriesTitle}`] : []),
  ];

  const clearFilters = () => {
    void navigate({
      search: (previous) => ({
        ...previous,
        dateRange: "all",
        page: 0,
        q: "",
        randomSeed: 0,
        seriesTitle: undefined,
        sortBy: "newest",
        tags: [],
        view: "chronological",
      }),
    });
  };

  const resultCount = firstPage?.meta.pagination.total ?? 0;

  return (
    <Box p={4} w="full">
      <Heading as="h1" mb={4} size="2xl">
        Posts
      </Heading>
      <PostsPageLayout
        dateRange={dateRange}
        discoveryView={view}
        fromRoute="/posts/"
        popularTags={popularTags}
        searchQuery={q}
        seriesTitle={seriesTitle}
        selectedTags={tags}
        sortBy={sortBy}
      >
        <PostsResultsState
          activeFilters={activeFilters}
          error={error}
          hasLoadedPosts={allPosts.length > 0}
          isPending={isPending}
          onClearFilters={clearFilters}
          onRetry={retry}
          resultCount={resultCount}
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
        </PostsResultsState>
      </PostsPageLayout>
    </Box>
  );
}
