import { useQuery, useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute, useRouteContext } from "@tanstack/react-router";
import { Schema } from "effect";
import { Suspense } from "react";
import { NotFound } from "src/components/NotFound";
import { PostDetailDisplay } from "src/components/PostDetail/PostDetailDisplay";
import { PostErrorComponent } from "src/components/PostError";
import { PostsPageLayout } from "src/components/PostsPageLayout";
import { Spinner } from "src/components/ui/feedback";
import { Stack } from "src/components/ui/layout";
import { Text } from "src/components/ui/typography";
import { toStandardSchemaV1Strict } from "src/lib/effect/schema.utils";
import { parse } from "src/lib/effect/schema.utils";
import { postQueryDetail, seriesHubQuery } from "src/lib/posts/posts.queries";
import { searchPostsBaseSchema } from "src/lib/posts/posts.schema";
import { getSeriesNavigation } from "src/lib/posts/series-hubs";

export const Route = createFileRoute("/posts/$postId")({
  component: PostComponent,
  errorComponent: PostErrorComponent,
  notFoundComponent: () => <NotFound>Post not found</NotFound>,
  params: {
    parse: (params) => ({
      postId: parse(Schema.NumberFromString)(params.postId),
    }),
  },
  validateSearch: toStandardSchemaV1Strict(searchPostsBaseSchema),
});

function PostComponent() {
  const { postId } = Route.useParams();
  const { dateRange, q, seriesTitle, sortBy, tags } = Route.useSearch();
  const context = useRouteContext({ from: "/posts/$postId" });

  const {
    data: { post, user, tags: initialTags, relatedPost, images },
  } = useSuspenseQuery(postQueryDetail(postId));
  const seriesQuery = useQuery({
    ...seriesHubQuery(post.animeTitle ?? ""),
    enabled: Boolean(post.animeTitle),
  });
  const seriesNavigation = seriesQuery.data
    ? getSeriesNavigation(seriesQuery.data.posts, post.id)
    : null;

  const currentUserId = context.user?.id;

  return (
    <PostsPageLayout
      dateRange={dateRange}
      fromRoute="/posts/$postId"
      popularTags={[]}
      searchQuery={q}
      seriesTitle={seriesTitle}
      selectedTags={tags}
      sortBy={sortBy}
      videoMetadata={post.videoMetadata}
    >
      <Suspense
        fallback={
          <Stack align="center" justify="center" minH="600px">
            <Spinner size="lg" />
            <Text>Loading post...</Text>
          </Stack>
        }
      >
        <PostDetailDisplay
          currentUserId={currentUserId}
          images={images}
          initialTags={initialTags}
          post={post}
          relatedPost={relatedPost}
          seriesNavigation={seriesNavigation}
          seriesPosts={seriesQuery.data?.posts}
          user={user}
        />
      </Suspense>
    </PostsPageLayout>
  );
}
