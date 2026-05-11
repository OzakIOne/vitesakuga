import { createContext } from "react";

import {
  addComment as _addComment,
  deleteComment as _deleteComment,
} from "./comments.fn";

export const CommentsFnsContext = createContext({
  addComment: _addComment,
  deleteComment: _deleteComment,
});
