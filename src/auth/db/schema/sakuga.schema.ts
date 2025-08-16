import { bigint, pgTable, serial, text, timestamp } from "drizzle-orm/pg-core";
import { user, userInsertSchema, userSelectSchema } from "./auth.schema";
import z from "zod";
import { createSchemaFactory } from "drizzle-zod";

const { createInsertSchema, createSelectSchema } = createSchemaFactory({
  coerce: true,
});

export const posts = pgTable("posts", {
  id: serial("id").primaryKey(),
  title: text().notNull(),
  content: text().notNull(),
  key: text().notNull(),
  createdAt: timestamp().defaultNow().notNull(),
  userId: text()
    .references(() => user.id)
    .notNull(),
});

export const postsSelectSchema = createSelectSchema(posts);
export const postsInsertSchema = createInsertSchema(posts);

export const comments = pgTable("comments", {
  id: serial("id").primaryKey(),
  postId: bigint({ mode: "number" })
    .references(() => posts.id)
    .notNull(),
  content: text().notNull(),
  createdAt: timestamp().defaultNow().notNull(),
  userId: text()
    .references(() => user.id)
    .notNull(),
});

export const commentsSelectSchema = createSelectSchema(comments);
export const commentsInsertSchema = createInsertSchema(comments);

type UserSelect = z.infer<typeof userSelectSchema>;
type PostsSelect = z.infer<typeof postsSelectSchema>;
type CommentsSelect = z.infer<typeof commentsSelectSchema>;

export type DbSchemaSelect = {
  user: UserSelect;
  posts: PostsSelect;
  comments: CommentsSelect;
};

type UserInsert = z.infer<typeof userInsertSchema>;
type PostsInsert = z.infer<typeof postsInsertSchema>;
type CommentsInsert = z.infer<typeof commentsInsertSchema>;

export type DbSchemaInsert = {
  user: UserInsert;
  posts: PostsInsert;
  comments: CommentsInsert;
};
