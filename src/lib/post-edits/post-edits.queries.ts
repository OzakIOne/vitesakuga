import { queryOptions } from "@tanstack/react-query";

import { fetchPostEdits } from "./post-edits.service";

export const postEditsKeys = {
  all: ["post-edits"] as const,
  post: (postId: number) => [...postEditsKeys.all, "post", postId] as const,
} as const;

export const postEditsQuery = (postId: number) =>
  queryOptions({
    queryFn: async () => fetchPostEdits({ data: { postId } }),
    queryKey: postEditsKeys.post(postId),
    staleTime: 15_000,
  });
