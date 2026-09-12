import { createFileRoute, notFound, redirect } from "@tanstack/react-router";
import { NotFound } from "src/components/NotFound";
import { RoutePending } from "src/components/RoutePending";
import { searchPosts } from "src/lib/posts/posts.service";
import { seo } from "src/utils/seo";

export const loadRandomVideo = async () => {
  const result = await searchPosts({
    data: {
      dateRange: "all",
      page: 0,
      q: "",
      randomSeed: Math.floor(Math.random() * Number.MAX_SAFE_INTEGER),
      sortBy: "newest",
      tags: ["video"],
      view: "random-study",
    },
  });
  const post = result.data[0];

  if (post === undefined) {
    throw notFound();
  }

  throw redirect({
    params: { postId: String(post.id) },
    to: "/posts/$postId",
  });
};

export const Route = createFileRoute("/random")({
  loader: loadRandomVideo,
  notFoundComponent: () => <NotFound>No videos are available yet.</NotFound>,
  pendingComponent: RoutePending,
  head: () => ({
    meta: seo({
      description: "Open a random video from the ViteSakuga archive.",
      noIndex: true,
      title: "Random video · ViteSakuga",
    }),
  }),
});
