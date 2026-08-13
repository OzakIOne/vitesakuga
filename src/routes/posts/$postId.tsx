import { useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute, useRouteContext } from "@tanstack/react-router";
import { Schema } from "effect";
import { Suspense, useState } from "react";
import { NotFound } from "src/components/NotFound";
import { PostDetailDisplay } from "src/components/PostDetail/PostDetailDisplay";
import { PostEditForm } from "src/components/PostDetail/PostEditForm";
import { PostErrorComponent } from "src/components/PostError";
import { PostsPageLayout } from "src/components/PostsPageLayout";
import { Spinner } from "src/components/ui/feedback";
import { Stack } from "src/components/ui/layout";
import { Text } from "src/components/ui/typography";
import { toStandardSchemaV1Strict } from "src/lib/effect/schema.utils";
import { parse } from "src/lib/effect/schema.utils";
import { postQueryDetail } from "src/lib/posts/posts.queries";
import { searchPostsBaseSchema } from "src/lib/posts/posts.schema";

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
  const { dateRange, q, sortBy, tags } = Route.useSearch();
  const context = useRouteContext({ from: "/posts/$postId" });

  const {
    data: { post, user, tags: initialTags, relatedPost },
  } = useSuspenseQuery(postQueryDetail(postId));

  const currentUserId = context.user?.id;
  const isOwner = currentUserId === user.id;
  const [isEditMode, setIsEditMode] = useState(false);

  const handleEditClick = () => {
    setIsEditMode(true);
  };
  const handleCancelEdit = () => {
    setIsEditMode(false);
  };

  return (
    <>
      {isEditMode && isOwner ? (
        <PostEditForm
          initialTags={initialTags}
          onCancel={handleCancelEdit}
          onSuccess={() => {
            setIsEditMode(false);
          }}
          post={post}
          postId={postId}
        />
      ) : (
        <PostsPageLayout
          dateRange={dateRange}
          fromRoute="/posts/$postId"
          popularTags={[]}
          searchQuery={q}
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
              initialTags={initialTags}
              onEditClick={handleEditClick}
              post={post}
              relatedPost={relatedPost}
              user={user}
            />
          </Suspense>
        </PostsPageLayout>
      )}
    </>
  );
}
