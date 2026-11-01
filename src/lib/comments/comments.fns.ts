import type { CommentsFns } from "./comments.fn-context";
import {
  addComment,
  deleteComment,
  fetchComments,
  updateComment,
} from "./comments.service";

export const defaultCommentsFns: CommentsFns = {
  addComment,
  deleteComment,
  fetchComments,
  updateComment,
};
