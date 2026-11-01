import { queryOptions } from "@tanstack/react-query";

import type { CommentsFns } from "./comments.fn-context";
import { commentsKeys } from "./comments.queries";

export const commentsQueryOptions = (
  postId: number,
  fetchCommentsFn: CommentsFns["fetchComments"],
) =>
  queryOptions({
    gcTime: 5 * 60 * 1000, // 5 minutes
    queryFn: () => fetchCommentsFn({ data: postId }),
    queryKey: commentsKeys.post(postId),
    staleTime: 30 * 1000, // 30 seconds
  });
