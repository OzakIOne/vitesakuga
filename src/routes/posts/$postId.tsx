import { Box, Spinner, Stack, Text } from "@chakra-ui/react";
import { useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute, useNavigate, useRouteContext } from "@tanstack/react-router";
import { Suspense, useState } from "react";
import { NotFound } from "src/components/NotFound";
import { PostDetailDisplay } from "src/components/PostDetail/PostDetailDisplay";
import { PostEditForm } from "src/components/PostDetail/PostEditForm";
import { PostErrorComponent } from "src/components/PostError";
import { PostsPageLayout } from "src/components/PostsPageLayout";
import { postQueryDetail } from "src/lib/posts/posts.queries";
import z from "zod";

export const Route = createFileRoute("/posts/$postId")({
  component: PostComponent,
  errorComponent: PostErrorComponent,
  notFoundComponent: () => {
    return <NotFound>Post not found</NotFound>;
  },
  params: {
    parse: (params) => ({
      postId: z.coerce.number().parse(params.postId),
    }),
  },
});

function PostContentComponent() {
  const { postId } = Route.useParams();
  const navigate = useNavigate();
  const context = useRouteContext({ from: "/posts/$postId" });

  const {
    data: { post, user, tags: initialTags, relatedPost },
  } = useSuspenseQuery(postQueryDetail(postId));

  const [isEditMode, setIsEditMode] = useState(false);

  const currentUserId = context.user?.id;
  const isOwner = currentUserId === user.id;

  const handleBack = () =>
    window.history.length > 1 ? window.history.back() : navigate({ to: ".." });
  const handleEditClick = () => setIsEditMode(true);
  const handleCancelEdit = () => setIsEditMode(false);

  return (
    <Box p={4}>
      {isEditMode && isOwner ? (
        <PostEditForm
          initialTags={initialTags}
          onCancel={handleCancelEdit}
          onSuccess={() => setIsEditMode(false)}
          post={post}
          postId={postId}
        />
      ) : (
        <PostsPageLayout
          dateRange="all"
          fromRoute="/posts/$postId"
          popularTags={[]}
          searchQuery={undefined}
          sortBy="newest"
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
              onBack={handleBack}
              onEditClick={handleEditClick}
              post={post}
              relatedPost={relatedPost}
              user={user}
            />
          </Suspense>
        </PostsPageLayout>
      )}
    </Box>
  );
}

function PostComponent() {
  return <PostContentComponent />;
}
