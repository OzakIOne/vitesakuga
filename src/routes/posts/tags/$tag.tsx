import { createFileRoute } from "@tanstack/react-router";
import { Schema } from "effect";
import { PostsPageLayout } from "src/components/posts/PostsPageLayout";
import { PostsResultsState } from "src/components/posts/PostsResultsState";
import { VirtualPostsGrid } from "src/components/posts/VirtualPostsGrid";
import { TagFollowButton } from "src/components/tags/TagFollowButton";
import { Box, HStack } from "src/components/ui/layout";
import { Heading } from "src/components/ui/typography";
import { usePostsInfiniteScroll } from "src/lib/posts/posts.hooks";
import { postsInfiniteQueryOptions } from "src/lib/posts/posts.query-options";
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

  const posts = usePostsInfiniteScroll(
    "/posts/tags/$tag",
    postsInfiniteQueryOptions({ ...searchParams, tags: [tag] }),
  );

  return (
    <PostsPageLayout
      dateRange={dateRange}
      discoveryView={view}
      fromRoute="/posts/tags/$tag"
      popularTags={posts.popularTags}
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
          error={posts.error}
          hasLoadedPosts={posts.hasLoadedPosts}
          isPending={posts.isPending}
          onClearFilters={() => {
            void navigate({
              search: { ...searchParams, page: 0, tags: [] },
              to: "/posts",
            });
          }}
          onRetry={posts.retry}
          resultCount={posts.resultCount}
        >
          <VirtualPostsGrid
            feed={posts.feed}
            searchParams={{ ...searchParams, tags: [tag] }}
          />
        </PostsResultsState>
      </Box>
    </PostsPageLayout>
  );
}
