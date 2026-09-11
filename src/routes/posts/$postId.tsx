import { useQuery, useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute, useRouteContext } from "@tanstack/react-router";
import { Schema } from "effect";
import { NotFound } from "src/components/NotFound";
import { PostDetailDisplay } from "src/components/PostDetail/PostDetailDisplay";
import { PostErrorComponent } from "src/components/PostError";
import { PostsPageLayout } from "src/components/PostsPageLayout";
import { assetUrl } from "src/lib/assets/url";
import { postQueryDetail, seriesHubQuery } from "src/lib/posts/posts.queries";
import { searchPostsBaseSchema } from "src/lib/posts/posts.schema";
import { getSeriesNavigation } from "src/lib/posts/series-hubs";
import { rethrowRouteDataError } from "src/lib/router/not-found";
import { parsePositiveIntegerRouteParam } from "src/lib/router/route-params";
import { seo } from "src/utils/seo";

export const Route = createFileRoute("/posts/$postId")({
  component: PostComponent,
  errorComponent: PostErrorComponent,
  validateSearch: Schema.toStandardSchemaV1(searchPostsBaseSchema),
  notFoundComponent: () => <NotFound>Post not found</NotFound>,
  loader: async ({ context, params }) => {
    const postId = parsePositiveIntegerRouteParam(params.postId);
    try {
      return await context.queryClient.query({
        ...postQueryDetail(postId),
        staleTime: "static",
      });
    } catch (error) {
      rethrowRouteDataError(error);
    }
  },
  head: ({ loaderData }) => {
    const metadata: Parameters<typeof seo>[0] = {
      description:
        loaderData?.post.description ||
        "Animation reference post on ViteSakuga.",
      title: loaderData
        ? `${loaderData.post.title} · ViteSakuga`
        : "Post · ViteSakuga",
    };

    if (loaderData) {
      metadata.image = assetUrl(loaderData.post.thumbnailKey);
    }

    return {
      meta: seo(metadata),
    };
  },
});

function PostComponent() {
  const { postId: rawPostId } = Route.useParams();
  const postId = parsePositiveIntegerRouteParam(rawPostId);
  const { dateRange, q, seriesTitle, sortBy, tags, view } = Route.useSearch();
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
      discoveryView={view}
      fromRoute="/posts/$postId"
      popularTags={[]}
      searchQuery={q}
      seriesTitle={seriesTitle}
      selectedTags={tags}
      sortBy={sortBy}
      videoMetadata={post.videoMetadata}
    >
      <PostDetailDisplay
        currentUserId={currentUserId}
        images={images}
        initialTags={initialTags}
        post={post}
        relatedPost={relatedPost}
        seriesNavigation={seriesNavigation}
        seriesPosts={seriesQuery.data?.posts}
        currentUserRole={context.user?.role}
        user={user}
      />
    </PostsPageLayout>
  );
}
