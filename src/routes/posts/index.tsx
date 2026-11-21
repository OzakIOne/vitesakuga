import { createFileRoute } from "@tanstack/react-router";
import { Schema } from "effect";
import {
  POST_DATE_RANGE_LABELS,
  POST_SORT_LABELS,
} from "src/components/posts/PostFilters";
import { PostsPageLayout } from "src/components/posts/PostsPageLayout";
import { PostsResultsState } from "src/components/posts/PostsResultsState";
import { VirtualPostsGrid } from "src/components/posts/VirtualPostsGrid";
import { Box } from "src/components/ui/layout";
import { Heading } from "src/components/ui/typography";
import { DISCOVERY_VIEW_INFO } from "src/lib/posts/discovery";
import { usePostsInfiniteScroll } from "src/lib/posts/posts.hooks";
import { postsInfiniteQueryOptions } from "src/lib/posts/posts.query-options";
import { searchPostsBaseSchema } from "src/lib/posts/posts.schema";
import { seo } from "src/utils/seo";

export const Route = createFileRoute("/posts/")({
  component: PostsContent,
  validateSearch: Schema.toStandardSchemaV1(searchPostsBaseSchema),
  head: () => ({
    meta: seo({
      description:
        "Browse and search the ViteSakuga animation reference archive.",
      title: "Posts · ViteSakuga",
    }),
  }),
});

function PostsContent() {
  const searchParams = Route.useSearch();
  const { dateRange, q, seriesTitle, sortBy, tags, view } = searchParams;
  const navigate = Route.useNavigate();

  const posts = usePostsInfiniteScroll(
    "/posts/",
    postsInfiniteQueryOptions(searchParams),
  );

  const activeFilters = [
    ...(q ? [`Search: ${q}`] : []),
    ...tags.map((tag) => `Tag: ${tag}`),
    ...(dateRange !== "all"
      ? [`Date: ${POST_DATE_RANGE_LABELS[dateRange]}`]
      : []),
    ...(sortBy !== "newest" ? [`Sort: ${POST_SORT_LABELS[sortBy]}`] : []),
    ...(view !== "chronological"
      ? [`View: ${DISCOVERY_VIEW_INFO[view].label}`]
      : []),
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

  return (
    <Box p={4} w="full">
      <Heading as="h1" mb={4} size="2xl">
        Posts
      </Heading>
      <PostsPageLayout
        dateRange={dateRange}
        discoveryView={view}
        fromRoute="/posts/"
        popularTags={posts.popularTags}
        searchQuery={q}
        seriesTitle={seriesTitle}
        selectedTags={tags}
        sortBy={sortBy}
      >
        <PostsResultsState
          activeFilters={activeFilters}
          error={posts.error}
          hasLoadedPosts={posts.hasLoadedPosts}
          isPending={posts.isPending}
          onClearFilters={clearFilters}
          onRetry={posts.retry}
          resultCount={posts.resultCount}
        >
          <VirtualPostsGrid feed={posts.feed} searchParams={searchParams} />
        </PostsResultsState>
      </PostsPageLayout>
    </Box>
  );
}
