import { createContext } from "react";

import {
  addComment as _addComment,
  deleteComment as _deleteComment,
  updateComment as _updateComment,
} from "./comments.service";

export const defaultCommentsFns = {
  addComment: _addComment,
  deleteComment: _deleteComment,
  updateComment: _updateComment,
};

export const CommentsFnsContext = createContext(defaultCommentsFns);
