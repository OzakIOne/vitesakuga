import {
  bigint,
  integer,
  pgTable,
  primaryKey,
  serial,
  text,
  timestamp,
} from "drizzle-orm/pg-core";
import { relations } from "node_modules/drizzle-orm";
import { user } from "./auth.schema";

export const tags = pgTable("tags", {
  id: serial("id").primaryKey(),
  name: text().notNull().unique(),
  createdAt: timestamp().defaultNow().notNull(),
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
  id: serial("id").primaryKey(),
  title: text().notNull(),
  content: text().notNull(),
  key: text().notNull(),
  source: text(),
  relatedPostId: integer(),
  createdAt: timestamp().defaultNow().notNull(),
  userId: text()
    .references(() => user.id)
    .notNull(),
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
  user: one(user, {
    fields: [posts.userId],
    references: [user.id],
  }),
  relatedPost: one(posts, {
    fields: [posts.relatedPostId],
    references: [posts.id],
  }),
  postTags: many(postTags),
}));

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
