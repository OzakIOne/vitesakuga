import type { PostEditsFns } from "./post-edits.fn-context";
import { approveEdit, proposeEdit, rejectEdit } from "./post-edits.service";

export const defaultPostEditsFns: PostEditsFns = {
  approveEdit,
  proposeEdit,
  rejectEdit,
};
