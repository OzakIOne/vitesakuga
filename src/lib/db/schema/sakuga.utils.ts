import { createSchemaFactory } from "drizzle-zod";
import type z from "zod";

import type { userInsertSchema, userSelectSchema } from "./auth.schema";
import {
  comments,
  playlists,
  playlistPosts,
  posts,
  tags,
} from "./sakuga.schema";

const { createInsertSchema, createSelectSchema } = createSchemaFactory({
  coerce: true,
});

export const tagsSelectSchema = createSelectSchema(tags);
export const tagsInsertSchema = createInsertSchema(tags);

export const postsSelectSchema = createSelectSchema(posts);
export const postsInsertSchema = createInsertSchema(posts);

export const commentsSelectSchema = createSelectSchema(comments).loose();
export const commentsInsertSchema = createInsertSchema(comments);

export const playlistsSelectSchema = createSelectSchema(playlists);
export const playlistsInsertSchema = createInsertSchema(playlists);

export const playlistPostsSelectSchema = createSelectSchema(playlistPosts);
export const playlistPostsInsertSchema = createInsertSchema(playlistPosts);

type UserSelect = z.infer<typeof userSelectSchema>;
type PostsSelect = z.infer<typeof postsSelectSchema>;
type CommentsSelect = z.infer<typeof commentsSelectSchema>;
type TagsSelect = z.infer<typeof tagsSelectSchema>;

export type DbSchemaSelect = {
  user: UserSelect;
  posts: PostsSelect;
  comments: CommentsSelect;
  tags: TagsSelect;
  playlists: z.infer<typeof playlistsSelectSchema>;
  playlistPosts: z.infer<typeof playlistPostsSelectSchema>;
};

type UserInsert = z.infer<typeof userInsertSchema>;
type PostsInsert = z.infer<typeof postsInsertSchema>;
type CommentsInsert = z.infer<typeof commentsInsertSchema>;
type TagsInsert = z.infer<typeof tagsInsertSchema>;

export type DbSchemaInsert = {
  user: UserInsert;
  posts: PostsInsert;
  comments: CommentsInsert;
  tags: TagsInsert;
  playlists: z.infer<typeof playlistsInsertSchema>;
  playlistPosts: z.infer<typeof playlistPostsInsertSchema>;
};
