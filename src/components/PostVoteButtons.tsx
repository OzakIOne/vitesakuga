import { memo } from "react";
import { LuThumbsDown, LuThumbsUp } from "react-icons/lu";
import { Button } from "src/components/ui/button";
import { HStack } from "src/components/ui/layout";
import { toaster } from "src/components/ui/toaster";
import type { PostVote } from "src/lib/db/schema";
import { usePostVotes, useSetVote } from "src/lib/votes/votes.hooks";

type PostVoteButtonsProps = {
  postId: number;
  currentUserId?: string | undefined;
};

function PostVoteButtonsComponent({
  postId,
  currentUserId,
}: PostVoteButtonsProps) {
  const { data } = usePostVotes(postId);
  const setVoteMutation = useSetVote(postId);

  const handleVote = (vote: PostVote) => {
    if (!currentUserId) {
      toaster.create({
        description: "Log in to vote on posts.",
        title: "Login required",
        type: "error",
      });
      return;
    }

    const nextVote = data?.userVote === vote ? null : vote;
    setVoteMutation.mutate(nextVote);
  };

  const isLikeActive = data?.userVote === "like";
  const isDislikeActive = data?.userVote === "dislike";
  const isPending = setVoteMutation.isPending;

  return (
    <HStack gap={2}>
      <Button
        aria-label="Like post"
        aria-pressed={isLikeActive}
        colorPalette="blue"
        disabled={isPending}
        onClick={() => {
          handleVote("like");
        }}
        size="sm"
        variant={isLikeActive ? "solid" : "outline"}
      >
        <LuThumbsUp aria-hidden />
        {data?.likes ?? 0}
      </Button>
      <Button
        aria-label="Dislike post"
        aria-pressed={isDislikeActive}
        colorPalette="red"
        disabled={isPending}
        onClick={() => {
          handleVote("dislike");
        }}
        size="sm"
        variant={isDislikeActive ? "solid" : "outline"}
      >
        <LuThumbsDown aria-hidden />
        {data?.dislikes ?? 0}
      </Button>
    </HStack>
  );
}

export const PostVoteButtons = memo(PostVoteButtonsComponent);
