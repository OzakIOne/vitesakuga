import { createContext } from "react";

import {
  addComment as _addComment,
  deleteComment as _deleteComment,
} from "./comments.fn";

export const defaultCommentsFns = {
  addComment: _addComment,
  deleteComment: _deleteComment,
};

export const CommentsFnsContext = createContext(defaultCommentsFns);
