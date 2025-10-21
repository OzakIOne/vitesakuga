import {
  bigint,
  pgTable,
  primaryKey,
  serial,
  text,
  timestamp,
} from "drizzle-orm/pg-core";
import { user, userInsertSchema, userSelectSchema } from "./auth.schema";
import z from "zod";
import { createSchemaFactory } from "drizzle-zod";

const { createInsertSchema, createSelectSchema } = createSchemaFactory({
  coerce: true,
});

export const tags = pgTable("tags", {
  id: serial("id").primaryKey(),
  name: text().notNull().unique(),
  createdAt: timestamp().defaultNow().notNull(),
});

export const tagsSelectSchema = createSelectSchema(tags);
export const tagsInsertSchema = createInsertSchema(tags);

export const postTags = pgTable(
  "post_tags",
  {
    postId: bigint({ mode: "number" })
      .references(() => posts.id)
      .notNull(),
    tagId: bigint({ mode: "number" })
      .references(() => tags.id)
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
  // @ts-expect-error safe circular reference
  relatedPostId: bigint({ mode: "number" }).references(() => posts.id),
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
