import type { PostsFns } from "./posts.fn-context";
import { updatePost } from "./posts.service";

export const defaultPostsFns: PostsFns = {
  updatePost,
};
