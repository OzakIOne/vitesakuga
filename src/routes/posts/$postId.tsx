import { Box } from "@chakra-ui/react";
import { useSuspenseQuery } from "@tanstack/react-query";
import {
  createFileRoute,
  useNavigate,
  useRouteContext,
} from "@tanstack/react-router";
import { useState } from "react";
import { NotFound } from "src/components/NotFound";
import { PostErrorComponent } from "src/components/PostError";
import { PostDetailDisplay } from "src/components/PostDetail/PostDetailDisplay";
import { PostDetailSidebar } from "src/components/PostDetail/PostDetailSidebar";
import { PostEditForm } from "src/components/PostDetail/PostEditForm";
import { SidebarLayout } from "src/components/layouts/SidebarLayout";
import { postQueryOptions } from "src/lib/posts/posts.queries";

export const Route = createFileRoute("/posts/$postId")({
  loader: async ({ params: { postId }, context }) => {
    await context.queryClient.ensureQueryData(postQueryOptions(Number(postId)));
  },
  errorComponent: PostErrorComponent,
  component: PostComponent,
  notFoundComponent: () => {
    return <NotFound>Post not found</NotFound>;
  },
});

function PostComponent() {
  const { postId } = Route.useParams();
  const id = parseInt(postId, 10);

  const navigate = useNavigate();
  const context = useRouteContext({ from: "/posts/$postId" });

  const { data: loaderData } = useSuspenseQuery(postQueryOptions(id));
  const { post, user, tags: initialTags, relatedPost } = loaderData;

  const [isEditMode, setIsEditMode] = useState(false);

  const currentUserId = context.user?.id;
  const isOwner = currentUserId === user.id;

  const handleBack = () => {
    if (window.history.length > 1) window.history.back();
    else navigate({ to: "/posts" });
  };

  const handleEditClick = () => {
    setIsEditMode(true);
  };

  const handleCancelEdit = () => {
    setIsEditMode(false);
  };

  return (
    <Box p={4}>
      {isEditMode && isOwner ? (
        <PostEditForm
          post={post}
          initialTags={initialTags}
          onSuccess={() => setIsEditMode(false)}
          onCancel={handleCancelEdit}
          postId={id}
        />
      ) : (
        <SidebarLayout
          sidebar={
            <PostDetailSidebar
              post={post}
              initialTags={initialTags}
              relatedPost={relatedPost}
            />
          }
          content={
            <PostDetailDisplay
              post={post}
              user={user}
              initialTags={initialTags}
              relatedPost={relatedPost}
              currentUserId={currentUserId}
              onEditClick={handleEditClick}
              onBack={handleBack}
            />
          }
        />
      )}
    </Box>
  );
}
