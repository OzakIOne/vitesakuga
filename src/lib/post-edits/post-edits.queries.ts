export const postEditsKeys = {
  all: ["post-edits"] as const,
  post: (postId: number) => [...postEditsKeys.all, "post", postId] as const,
} as const;
