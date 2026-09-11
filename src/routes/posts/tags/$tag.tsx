import { createFileRoute } from "@tanstack/react-router";
import { Schema } from "effect";
import { PostsPageLayout } from "src/components/PostsPageLayout";
import { PostsResultsState } from "src/components/PostsResultsState";
import { TagFollowButton } from "src/components/TagFollowButton";
import { Box, HStack } from "src/components/ui/layout";
import { Heading } from "src/components/ui/typography";
import { VirtualPostsGrid } from "src/components/VirtualPostsGrid";
import { usePostsInfiniteScroll } from "src/lib/posts/posts.hooks";
import { postsInfiniteQueryOptions } from "src/lib/posts/posts.queries";
import { searchPostsBaseSchema } from "src/lib/posts/posts.schema";
import { seo } from "src/utils/seo";

export const Route = createFileRoute("/posts/tags/$tag")({
  component: RouteComponent,
  validateSearch: Schema.toStandardSchemaV1(searchPostsBaseSchema),
  head: ({ params }) => ({
    meta: seo({
      description: `Posts tagged “${params.tag}” in the ViteSakuga animation archive.`,
      title: `${params.tag} posts · ViteSakuga`,
    }),
  }),
});

function RouteComponent() {
  const { tag } = Route.useParams();
  const searchParams = Route.useSearch();
  const { dateRange, sortBy, view } = searchParams;
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
    firstPage,
    isPending,
  } = usePostsInfiniteScroll(
    "/posts/tags/$tag",
    postsInfiniteQueryOptions({ ...searchParams, tags: [tag] }),
  );

  return (
    <PostsPageLayout
      dateRange={dateRange}
      discoveryView={view}
      fromRoute="/posts/tags/$tag"
      popularTags={popularTags}
      searchQuery={undefined}
      selectedTags={[tag]}
      sortBy={sortBy}
    >
      <Box border="1px" borderRadius="md" p={4}>
        <HStack flexWrap="wrap" justifyContent="space-between" mb={6}>
          <Heading as="h1">Posts tagged with “{tag}”</Heading>
          <TagFollowButton tagName={tag} />
        </HStack>

        <PostsResultsState
          activeFilters={[`Tag: ${tag}`]}
          error={error}
          hasLoadedPosts={allPosts.length > 0}
          isPending={isPending}
          onClearFilters={() => {
            void navigate({
              search: { ...searchParams, page: 0, tags: [] },
              to: "/posts",
            });
          }}
          onRetry={retry}
          resultCount={firstPage?.meta.pagination.total ?? 0}
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
            searchParams={{ ...searchParams, tags: [tag] }}
            syncPageToUrl={syncPageToUrl}
          />
        </PostsResultsState>
      </Box>
    </PostsPageLayout>
  );
}
