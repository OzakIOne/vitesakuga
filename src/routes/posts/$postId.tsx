import { Box } from "@chakra-ui/react";
import { useSuspenseQuery } from "@tanstack/react-query";
import {
  createFileRoute,
  useNavigate,
  useRouteContext,
} from "@tanstack/react-router";
import { useState } from "react";
import { NotFound } from "src/components/NotFound";
import { PostDetailDisplay } from "src/components/PostDetail/PostDetailDisplay";
import { PostEditForm } from "src/components/PostDetail/PostEditForm";
import { PostErrorComponent } from "src/components/PostError";
import { PostsPageLayout } from "src/components/PostsPageLayout";
import { postQueryDetail } from "src/lib/posts/posts.queries";

export const Route = createFileRoute("/posts/$postId")({
  errorComponent: PostErrorComponent,
  component: PostComponent,
  notFoundComponent: () => {
    return <NotFound>Post not found</NotFound>;
  },
});

function PostComponent() {
  const { postId } = Route.useParams();
  const id = Number(postId);
  const navigate = useNavigate();
  const context = useRouteContext({ from: "/posts/$postId" });

  const {
    data: { post, user, tags: initialTags, relatedPost },
  } = useSuspenseQuery(postQueryDetail(id));

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
        <PostsPageLayout
          searchQuery={undefined}
          popularTags={[]}
          sortBy="latest"
          dateRange="all"
          fromRoute="/posts/$postId"
        >
          <PostDetailDisplay
            post={post}
            user={user}
            initialTags={initialTags}
            relatedPost={relatedPost}
            currentUserId={currentUserId}
            onEditClick={handleEditClick}
            onBack={handleBack}
          />
        </PostsPageLayout>
      )}
    </Box>
  );
}
