import { Button } from "src/components/ui/button";
import { useCapabilities } from "src/lib/auth/capabilities.context";
import { useSetTagFollowed, useTagFollowState } from "src/lib/tags/tags.hooks";

export function TagFollowButton({ tagName }: { tagName: string }) {
  const { actorId, hasMutationActor } = useCapabilities();
  const followState = useTagFollowState(tagName, actorId !== null);
  const mutation = useSetTagFollowed(tagName);

  if (actorId === null) {
    return (
      <Button disabled size="sm" variant="outline">
        Sign in to follow
      </Button>
    );
  }

  if (!hasMutationActor) return null;

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
