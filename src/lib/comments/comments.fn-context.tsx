import { createContext, useContext } from "react";

import type {
  addComment,
  deleteComment,
  fetchComments,
  updateComment,
} from "./comments.service";

export type CommentsFns = {
  addComment: typeof addComment;
  deleteComment: typeof deleteComment;
  fetchComments: typeof fetchComments;
  updateComment: typeof updateComment;
};

export const CommentsFnsContext = createContext<CommentsFns | null>(null);

export const useCommentsFns = (): CommentsFns => {
  const fns = useContext(CommentsFnsContext);
  if (fns === null) {
    throw new Error("CommentsFnsContext is not provided");
  }
  return fns;
};
