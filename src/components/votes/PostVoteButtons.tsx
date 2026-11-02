import { memo } from "react";
import { LuThumbsDown, LuThumbsUp } from "react-icons/lu";
import { Button } from "src/components/ui/button";
import { HStack } from "src/components/ui/layout";
import { Text } from "src/components/ui/typography";
import { useCapabilities } from "src/lib/auth/capabilities.context";
import type { PostVote } from "src/lib/db/schema";
import { usePostVotes, useSetVote } from "src/lib/votes/votes.hooks";

type PostVoteButtonsProps = {
  postId: number;
};

function PostVoteButtonsComponent({ postId }: PostVoteButtonsProps) {
  const { actorId, hasMutationActor } = useCapabilities();
  const { data } = usePostVotes(postId);
  const setVoteMutation = useSetVote(postId);

  const handleVote = (vote: PostVote) => {
    if (!hasMutationActor) return;

    const nextVote = data?.userVote === vote ? null : vote;
    setVoteMutation.mutate(nextVote);
  };

  const isLikeActive = data?.userVote === "like";
  const isDislikeActive = data?.userVote === "dislike";
  const isPending = setVoteMutation.isPending;
  const requiresSignIn = actorId === null;

  if (actorId !== null && !hasMutationActor) {
    return (
      <HStack gap={2}>
        <Text aria-label={`${data?.likes ?? 0} likes`}>
          <LuThumbsUp aria-hidden /> {data?.likes ?? 0}
        </Text>
        <Text aria-label={`${data?.dislikes ?? 0} dislikes`}>
          <LuThumbsDown aria-hidden /> {data?.dislikes ?? 0}
        </Text>
      </HStack>
    );
  }

  return (
    <HStack gap={2}>
      <Button
        aria-label={requiresSignIn ? "Sign in to like this post" : "Like post"}
        aria-pressed={requiresSignIn ? undefined : isLikeActive}
        colorPalette="blue"
        disabled={isPending || requiresSignIn}
        onClick={() => {
          handleVote("like");
        }}
        size="sm"
        title={requiresSignIn ? "Sign in to vote" : undefined}
        variant={isLikeActive ? "solid" : "outline"}
      >
        <LuThumbsUp aria-hidden />
        {data?.likes ?? 0}
      </Button>
      <Button
        aria-label={
          requiresSignIn ? "Sign in to dislike this post" : "Dislike post"
        }
        aria-pressed={requiresSignIn ? undefined : isDislikeActive}
        colorPalette="red"
        disabled={isPending || requiresSignIn}
        onClick={() => {
          handleVote("dislike");
        }}
        size="sm"
        title={requiresSignIn ? "Sign in to vote" : undefined}
        variant={isDislikeActive ? "solid" : "outline"}
      >
        <LuThumbsDown aria-hidden />
        {data?.dislikes ?? 0}
      </Button>
    </HStack>
  );
}

export const PostVoteButtons = memo(PostVoteButtonsComponent);
