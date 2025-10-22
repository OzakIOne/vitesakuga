import {
  bigint,
  integer,
  pgTable,
  primaryKey,
  serial,
  text,
  timestamp,
} from "drizzle-orm/pg-core";
import { user, userInsertSchema, userSelectSchema } from "./auth.schema";
import z from "zod";
import { createSchemaFactory } from "drizzle-zod";
import { relations } from "node_modules/drizzle-orm";

const { createInsertSchema, createSelectSchema } = createSchemaFactory({
  coerce: true,
});

export const tags = pgTable("tags", {
  id: serial("id").primaryKey(),
  name: text().notNull().unique(),
  createdAt: timestamp().defaultNow().notNull(),
});
// Tags relations
export const tagsRelations = relations(tags, ({ many }) => ({
  postTags: many(postTags),
}));

export const tagsSelectSchema = createSelectSchema(tags);
export const tagsInsertSchema = createInsertSchema(tags);

// Post-Tags junction table - use integer to match serial
export const postTags = pgTable(
  "post_tags",
  {
    postId: integer("post_id")
      .references(() => posts.id, { onDelete: "cascade" })
      .notNull(),
    tagId: integer("tag_id")
      .references(() => tags.id, { onDelete: "cascade" })
      .notNull(),
  },
  (t) => [primaryKey({ columns: [t.postId, t.tagId] })]
);

export const posts = pgTable("posts", {
  id: serial("id").primaryKey(),
  title: text().notNull(),
  content: text().notNull(),
  key: text().notNull(),
  source: text(),
  relatedPostId: integer("related_post_id"), // Changed from bigint
  createdAt: timestamp().defaultNow().notNull(),
  userId: text()
    .references(() => user.id)
    .notNull(),
});

// Post-Tags relations
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
