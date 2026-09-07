import { createFileRoute } from "@tanstack/react-router";
import { PostsPageLayout } from "src/components/PostsPageLayout";
import { TagFollowButton } from "src/components/TagFollowButton";
import { Box, HStack } from "src/components/ui/layout";
import { Heading } from "src/components/ui/typography";
import { VirtualPostsGrid } from "src/components/VirtualPostsGrid";
import { toStandardSchemaV1Strict } from "src/lib/effect/schema.utils";
import { usePostsInfiniteScroll } from "src/lib/posts/posts.hooks";
import { postsInfiniteQueryOptions } from "src/lib/posts/posts.queries";
import { searchPostsBaseSchema } from "src/lib/posts/posts.schema";

export const Route = createFileRoute("/posts/tags/$tag")({
  component: RouteComponent,
  // fix initial window is not defined error
  validateSearch: toStandardSchemaV1Strict(searchPostsBaseSchema),
  ssr: "data-only",
});

function RouteComponent() {
  const { tag } = Route.useParams();
  const searchParams = Route.useSearch();
  const { dateRange, sortBy, view } = searchParams;

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
        <HStack justifyContent="space-between" mb={6}>
          <Heading as="h1">Posts tagged with “{tag}”</Heading>
          <TagFollowButton tagName={tag} />
        </HStack>

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
      </Box>
    </PostsPageLayout>
  );
}
