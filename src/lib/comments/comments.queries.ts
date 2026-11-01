export const commentsKeys = {
  all: ["comments"] as const,
  post: (postId: number) => [...commentsKeys.all, "post", postId] as const,
} as const;
