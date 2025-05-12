import {
  integer,
  pgTable,
  primaryKey,
  serial,
  text,
  timestamp,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";
import { sql, type InferSelectModel } from "drizzle-orm";

export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  uuid: uuid("uuid")
    .default(sql`gen_random_uuid()`)
    .notNull(),
  username: varchar("username", { length: 50 }).notNull(),
  email: varchar("email", { length: 100 }).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const posts = pgTable("posts", {
  id: serial("id").primaryKey(),
  title: varchar("title", { length: 255 }).notNull(),
  content: text("content").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const comments = pgTable("comments", {
  id: serial("id").primaryKey(),
  postId: integer("post_id")
    .references(() => posts.id)
    .notNull(),
  userId: integer("user_id")
    .references(() => users.id)
    .notNull(),
  content: text("content").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const tags = pgTable("tags", {
  id: serial("id").primaryKey(),
  name: varchar("name", { length: 50 }).notNull(),
});

export const postTags = pgTable(
  "post_tags",
  {
    postId: integer("post_id")
      .references(() => posts.id)
      .notNull(),
    tagId: integer("tag_id")
      .references(() => tags.id)
      .notNull(),
  },
  (table) => [primaryKey({ columns: [table.postId, table.tagId] })]
);

export type User = InferSelectModel<typeof users>;
export type Post = InferSelectModel<typeof posts>;
export type Comment = InferSelectModel<typeof comments>;
export type Tag = InferSelectModel<typeof tags>;
export type PostTag = InferSelectModel<typeof postTags>;

export type DatabaseSchema = {
  users: User;
  posts: Post;
  comments: Comment;
  tags: Tag;
  postTags: PostTag;
};
