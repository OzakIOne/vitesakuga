import {
  integer,
  pgTable,
  serial,
  text,
  timestamp,
  varchar,
} from "drizzle-orm/pg-core";
import { user, UserInsert, UserSelect } from "./auth.schema";
import z from "zod";
import { createSchemaFactory } from "drizzle-zod";

export const { createInsertSchema, createSelectSchema } = createSchemaFactory({
  coerce: true,
});
export const posts = pgTable("posts", {
  id: serial("id").primaryKey(),
  title: varchar("title", { length: 255 }).notNull(),
  content: text("content").notNull(),
  key: text("key").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  userId: text("user_id")
    .references(() => user.id)
    .notNull(),
});

export const postsSelectSchema = createSelectSchema(posts);
export const postsInsertSchema = createInsertSchema(posts);

export const comments = pgTable("comments", {
  id: serial("id").primaryKey(),
  postId: integer("post_id")
    .references(() => posts.id)
    .notNull(),
  content: text("content").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  userId: text("user_id")
    .references(() => user.id)
    .notNull(),
});

export const commentsSelectSchema = createSelectSchema(comments);
export const commentsInsertSchema = createInsertSchema(comments);

export type PostsSelect = z.infer<typeof postsSelectSchema>;
export type CommentsSelect = z.infer<typeof commentsSelectSchema>;

export type DbSchemaSelect = {
  user: UserSelect;
  posts: PostsSelect;
  comments: CommentsSelect;
};

export type PostsInsert = z.infer<typeof postsInsertSchema>;
export type CommentsInsert = z.infer<typeof commentsInsertSchema>;

export type DbSchemaInsert = {
  user: UserInsert;
  posts: PostsInsert;
  comments: CommentsInsert;
};
