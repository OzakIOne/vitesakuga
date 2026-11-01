import { queryOptions } from "@tanstack/react-query";

import { postEditsKeys } from "./post-edits.queries";
import { fetchPostEdits } from "./post-edits.service";

export const postEditsQuery = (postId: number) =>
  queryOptions({
    queryFn: () => fetchPostEdits({ data: { postId } }),
    queryKey: postEditsKeys.post(postId),
    staleTime: 15_000,
  });
