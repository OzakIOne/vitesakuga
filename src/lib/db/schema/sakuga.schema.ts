import {
  bigint,
  integer,
  json,
  pgTable,
  primaryKey,
  serial,
  text,
  timestamp,
} from "drizzle-orm/pg-core";
import DOMPurify from "isomorphic-dompurify";
import { relations } from "node_modules/drizzle-orm";
import { z } from "zod";
import { createInsertSchema, user } from "./auth.schema";

export const tags = pgTable("tags", {
  createdAt: timestamp().defaultNow().notNull(),
  id: serial("id").primaryKey(),
  name: text().notNull().unique(),
});

export const tagsRelations = relations(tags, ({ many }) => ({
  postTags: many(postTags),
}));

// Post-Tags junction table - use integer to match serial
export const postTags = pgTable(
  "post_tags",
  {
    postId: integer()
      .references(() => posts.id, { onDelete: "cascade" })
      .notNull(),
    tagId: integer()
      .references(() => tags.id, { onDelete: "cascade" })
      .notNull(),
  },
  (t) => [primaryKey({ columns: [t.postId, t.tagId] })],
);

export const posts = pgTable("posts", {
  content: text().notNull(),
  createdAt: timestamp().defaultNow().notNull(),
  id: serial("id").primaryKey(),
  relatedPostId: integer(),
  source: text(),
  thumbnailKey: text().notNull(),
  title: text().notNull(),
  userId: text()
    .references(() => user.id)
    .notNull(),
  videoKey: text().notNull(),
  videoMetadata: json().$type<string>().notNull(),
});

export const postTagsRelations = relations(postTags, ({ one }) => ({
  post: one(posts, {
    fields: [postTags.postId],
    references: [posts.id],
  }),
  tag: one(tags, {
    fields: [postTags.tagId],
    references: [tags.id],
  }),
}));

export const postsRelations = relations(posts, ({ one, many }) => ({
  postTags: many(postTags),
  relatedPost: one(posts, {
    fields: [posts.relatedPostId],
    references: [posts.id],
  }),
  user: one(user, {
    fields: [posts.userId],
    references: [user.id],
  }),
}));

export const comments = pgTable("comments", {
  content: text().notNull(),
  createdAt: timestamp().defaultNow().notNull(),
  id: serial("id").primaryKey(),
  postId: bigint({ mode: "number" })
    .references(() => posts.id, { onDelete: "cascade" })
    .notNull(),
  userId: text()
    .references(() => user.id)
    .notNull(),
});

export const commentInsertSchema = createInsertSchema(comments, {
  content: z.string().transform((val) => DOMPurify.sanitize(val)),
});
