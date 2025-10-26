import { z } from "zod";

export const searchTagsSchema = z.object({
  query: z.string().min(1),
});

export const fetchPostsByTagSchema = z.object({
  tagName: z.string(),
});

export type PostWithUser = {
  post: {
    id: number;
    title: string;
    content: string;
    key: string;
    source: string | null;
    relatedPostId: number | null;
    createdAt: Date;
    userId: string;
  };
  user: {
    id: string;
    name: string;
    image: string | null;
  };
};
