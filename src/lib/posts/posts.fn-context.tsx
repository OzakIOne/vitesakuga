import { createContext, useContext } from "react";

import type { updatePost } from "./posts.service";

export type PostsFns = {
  updatePost: typeof updatePost;
};

export const PostsFnsContext = createContext<PostsFns | null>(null);

export const usePostsFns = (): PostsFns => {
  const fns = useContext(PostsFnsContext);
  if (fns === null) {
    throw new Error("PostsFnsContext is not provided");
  }
  return fns;
};
