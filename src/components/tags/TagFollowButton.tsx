import { useRouteContext } from "@tanstack/react-router";
import { Button } from "src/components/ui/button";
import { useSetTagFollowed, useTagFollowState } from "src/lib/tags/tags.hooks";

export function TagFollowButton({ tagName }: { tagName: string }) {
  const { user } = useRouteContext({ from: "__root__" });
  const followState = useTagFollowState(tagName, user !== null);
  const mutation = useSetTagFollowed(tagName);

  if (user === null) {
    return (
      <Button disabled size="sm" variant="outline">
        Sign in to follow
      </Button>
    );
  }

  const followed = followState.data?.followed ?? false;
  return (
    <Button
      aria-pressed={followed}
      disabled={followState.isPending || mutation.isPending}
      onClick={() => mutation.mutate(!followed)}
      size="sm"
      variant={followed ? "solid" : "outline"}
    >
      {followed ? "Following tag" : "Follow tag"}
    </Button>
  );
}
