import { createContext, useContext } from "react";

import type {
  approveEdit,
  proposeEdit,
  rejectEdit,
} from "./post-edits.service";

export type PostEditsFns = {
  approveEdit: typeof approveEdit;
  proposeEdit: typeof proposeEdit;
  rejectEdit: typeof rejectEdit;
};

export const PostEditsFnsContext = createContext<PostEditsFns | null>(null);

export const usePostEditsFns = (): PostEditsFns => {
  const fns = useContext(PostEditsFnsContext);
  if (fns === null) {
    throw new Error("PostEditsFnsContext is not provided");
  }
  return fns;
};
