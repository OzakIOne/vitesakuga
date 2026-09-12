import { createFileRoute, notFound, redirect } from "@tanstack/react-router";
import { NotFound } from "src/components/NotFound";
import { RoutePending } from "src/components/RoutePending";
import { fetchRandomPostId } from "src/lib/posts/posts.service";
import { seo } from "src/utils/seo";

export const loadRandomVideo = async () => {
  const postId = await fetchRandomPostId({
    data: {
      randomSeed: Math.floor(Math.random() * Number.MAX_SAFE_INTEGER),
    },
  });

  if (postId === null) {
    throw notFound();
  }

  throw redirect({
    params: { postId: String(postId) },
    to: "/posts/$postId",
  });
};

export const Route = createFileRoute("/random")({
  loader: loadRandomVideo,
  notFoundComponent: () => <NotFound>No posts are available yet.</NotFound>,
  pendingComponent: RoutePending,
  head: () => ({
    meta: seo({
      description: "Open a random post from the ViteSakuga archive.",
      noIndex: true,
      title: "Random post · ViteSakuga",
    }),
  }),
});
