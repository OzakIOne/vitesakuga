import { createSchemaFactory } from "drizzle-zod";
import type z from "zod";
import type { userInsertSchema, userSelectSchema } from "./auth.schema";
import { comments, posts, tags } from "./sakuga.schema";

const { createInsertSchema, createSelectSchema } = createSchemaFactory({
  coerce: true,
});

export const tagsSelectSchema = createSelectSchema(tags);
export const tagsInsertSchema = createInsertSchema(tags);

export const postsSelectSchema = createSelectSchema(posts);
export const postsInsertSchema = createInsertSchema(posts);

export const commentsSelectSchema = createSelectSchema(comments);
export const commentsInsertSchema = createInsertSchema(comments);

type UserSelect = z.infer<typeof userSelectSchema>;
type PostsSelect = z.infer<typeof postsSelectSchema>;
type CommentsSelect = z.infer<typeof commentsSelectSchema>;
type TagsSelect = z.infer<typeof tagsSelectSchema>;

export type DbSchemaSelect = {
  user: UserSelect;
  posts: PostsSelect;
  comments: CommentsSelect;
  tags: TagsSelect;
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
};
