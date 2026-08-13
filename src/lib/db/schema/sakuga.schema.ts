import {
  bigint,
  boolean,
  integer,
  json,
  pgTable,
  primaryKey,
  serial,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { Schema, SchemaGetter } from "effect";

import { sanitize } from "../../sanitize";
import { user } from "./auth.schema";

export const tags = pgTable("tags", {
  createdAt: timestamp().defaultNow().notNull(),
  id: serial("id").primaryKey(),
  name: text().notNull().unique(),
});

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

export const postVotes = pgTable(
  "post_votes",
  {
    createdAt: timestamp().defaultNow().notNull(),
    postId: integer()
      .references(() => posts.id, { onDelete: "cascade" })
      .notNull(),
    userId: text()
      .references(() => user.id, { onDelete: "cascade" })
      .notNull(),
    vote: text().notNull(),
  },
  (t) => [primaryKey({ columns: [t.postId, t.userId] })],
);

export const playlists = pgTable("playlists", {
  createdAt: timestamp("created_at").defaultNow().notNull(),
  description: text("description"),
  id: serial("id").primaryKey(),
  isPublic: boolean("is_public").notNull().default(false),
  title: text("title").notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
  userId: text("user_id")
    .references(() => user.id, { onDelete: "cascade" })
    .notNull(),
});

export const playlistPosts = pgTable(
  "playlist_posts",
  {
    playlistId: integer("playlist_id")
      .references(() => playlists.id, { onDelete: "cascade" })
      .notNull(),
    postId: integer("post_id").notNull(),
    position: integer("position").notNull().default(0),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("unique_playlist_post").on(table.playlistId, table.postId),
  ],
);

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

export const commentInsertSchema = Schema.Struct({
  content: Schema.String.pipe(
    Schema.decode({
      decode: SchemaGetter.transform((val) => sanitize(val)),
      encode: SchemaGetter.transform((val) => val),
    }),
  ),
  createdAt: Schema.optionalKey(Schema.Date),
  id: Schema.optionalKey(Schema.Number),
  postId: Schema.Number,
  userId: Schema.String,
});
