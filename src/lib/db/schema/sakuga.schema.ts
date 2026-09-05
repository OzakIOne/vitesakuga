import {
  bigint,
  boolean,
  index,
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

import { PostId } from "../../ids";
import type { PointAction } from "../../points/points.config";
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
  animeTitle: text(),
  chapterNumber: integer(),
  createdAt: timestamp().defaultNow().notNull(),
  description: text().notNull(),
  episodeNumber: integer(),
  id: serial("id").primaryKey(),
  relatedPostId: integer(),
  seasonNumber: integer(),
  source: text(),
  sourceType: text(),
  thumbnailKey: text().notNull(),
  title: text().notNull(),
  userId: text()
    .references(() => user.id)
    .notNull(),
  videoKey: text(),
  videoMetadata: json().$type<string>().notNull(),
  volumeNumber: integer(),
});

// One row per attached image; `position` orders them for display. Posts
// currently expose a single image in the UI, but the table already supports
// several per post for a future multi-image upload.
export const postImages = pgTable(
  "post_images",
  {
    createdAt: timestamp().defaultNow().notNull(),
    postId: integer()
      .references(() => posts.id, { onDelete: "cascade" })
      .notNull(),
    position: integer().notNull().default(0),
    storageKey: text().notNull(),
  },
  (t) => [index("post_images_post_id_position_idx").on(t.postId, t.position)],
);

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

export const postReports = pgTable(
  "post_reports",
  {
    createdAt: timestamp().defaultNow().notNull(),
    postId: integer()
      .references(() => posts.id, { onDelete: "cascade" })
      .notNull(),
    reason: text().notNull(),
    userId: text()
      .references(() => user.id, { onDelete: "cascade" })
      .notNull(),
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

// @mentions resolved in comment content (src/lib/mentions). One row per
// (comment, mentioned user); notifications for new mentions are written
// alongside these rows by CommentsService. The mention stays attached to the
// user id, so a later username change never breaks an old comment.
export const commentMentions = pgTable(
  "comment_mentions",
  {
    commentId: integer()
      .references(() => comments.id, { onDelete: "cascade" })
      .notNull(),
    createdAt: timestamp().defaultNow().notNull(),
    userId: text()
      .references(() => user.id, { onDelete: "cascade" })
      .notNull(),
  },
  (t) => [
    primaryKey({ columns: [t.commentId, t.userId] }),
    index("comment_mentions_user_idx").on(t.userId),
  ],
);

// Append-only points history (src/lib/points). One row per earning event;
// totals and daily caps are derived by aggregation. The unique index makes
// each (user, action, resource, actor) combination earn points only once,
// so remove-and-relike cycles cannot farm likes.
export const pointsLedger = pgTable(
  "points_ledger",
  {
    // Who triggered the event (voter, commenter…); null when the event has
    // no external actor. Like awards record the voter here.
    action: text().$type<PointAction>().notNull(),
    actorId: text(),
    createdAt: timestamp().defaultNow().notNull(),
    id: serial("id").primaryKey(),
    points: integer().notNull(),
    refId: integer(),
    userId: text()
      .references(() => user.id, { onDelete: "cascade" })
      .notNull(),
  },
  (t) => [
    uniqueIndex("points_ledger_earning_unique").on(
      t.userId,
      t.action,
      t.refId,
      t.actorId,
    ),
  ],
);

// Comments are written at high volume and each resolved mention fans out
// into a `comment_mentions` row plus a notification, so unbounded content is
// a storage/notification spam amplifier (security audit M2).
export const MAX_COMMENT_LENGTH = 2000;

const commentContent = Schema.String.pipe(
  Schema.decode({
    decode: SchemaGetter.transform((val) => sanitize(val)),
    encode: SchemaGetter.transform((val) => val),
  }),
  Schema.check(
    Schema.isMaxLength(MAX_COMMENT_LENGTH, {
      message: `Comments must not exceed ${MAX_COMMENT_LENGTH} characters`,
    }),
  ),
);

// Comment insert input. No userId here: it is derived from the authenticated
// session server-side (see CommentsService.add); trusting a client-sent userId
// would let any caller impersonate another user.
export const commentInsertSchema = Schema.Struct({
  content: commentContent,
  postId: PostId,
});

// Comment edit input. Ownership is checked server-side (CommentsService.update).
export const commentUpdateSchema = Schema.Struct({
  commentId: Schema.Number,
  content: commentContent,
});

// Audit row for each novice → uploader decision (src/lib/promotions). The
// review queue itself is derived live from points + account age; this table
// records what staff decided and when, and keeps rejected candidates out of
// the queue until they earn more points than the snapshot taken at rejection.
export const promotionReviews = pgTable("promotion_reviews", {
  createdAt: timestamp().defaultNow().notNull(),
  id: serial().primaryKey(),
  pointsAtReview: integer().notNull(),
  reviewedBy: text(),
  status: text().$type<"approved" | "rejected">().notNull(),
  userId: text()
    .references(() => user.id, { onDelete: "cascade" })
    .notNull(),
});

// In-app notification inbox (src/lib/notifications). Rows are created
// server-side by business events (promotion approved/rejected…); clients
// fetch on load / after actions and flip readAt when the inbox is opened.
export const notifications = pgTable(
  "notifications",
  {
    createdAt: timestamp().defaultNow().notNull(),
    id: serial().primaryKey(),
    // Post the notification points at (a mentioned user lands on the comment
    // thread); null for notification types that have no deep link.
    postId: integer(),
    readAt: timestamp(),
    type: text()
      .$type<
        | "comment-mention"
        | "edit-suggestion-applied"
        | "promotion-approved"
        | "promotion-rejected"
      >()
      .notNull(),
    userId: text()
      .references(() => user.id, { onDelete: "cascade" })
      .notNull(),
  },
  (t) => [index("notifications_user_idx").on(t.userId, t.createdAt)],
);

// Wiki-style edit suggestions on other users' posts (src/lib/post-edits).
// `payload` holds the proposed field changes as a JSON string. A suggestion
// applies when a moderator/admin decides so, or after two distinct uploader
// approvals; the row then doubles as the applied-change history entry.
export const postEdits = pgTable("post_edits", {
  createdAt: timestamp().defaultNow().notNull(),
  id: serial().primaryKey(),
  payload: json().$type<string>().notNull(),
  postId: integer()
    .references(() => posts.id, { onDelete: "cascade" })
    .notNull(),
  resolvedAt: timestamp(),
  resolvedBy: text(),
  status: text().$type<"approved" | "pending" | "rejected">().notNull(),
  suggestedBy: text()
    .references(() => user.id)
    .notNull(),
});

// One row per uploader backing a pending suggestion; two distinct rows (or
// one staff/owner decision) make it apply. The suggester can never appear
// here.
export const postEditApprovals = pgTable(
  "post_edit_approvals",
  {
    createdAt: timestamp().defaultNow().notNull(),
    editId: integer()
      .references(() => postEdits.id, { onDelete: "cascade" })
      .notNull(),
    userId: text()
      .references(() => user.id)
      .notNull(),
  },
  (t) => [primaryKey({ columns: [t.editId, t.userId] })],
);

// History of video replacements (src/lib/videos). Replacing a post's video
// keeps its id, author, likes and comments; the old object key moves here so
// staff can roll back. Rows are purged after RETENTION_DAYS without an
// open report on their post.
export const videoRevisions = pgTable(
  "video_revisions",
  {
    createdAt: timestamp().defaultNow().notNull(),
    id: serial().primaryKey(),
    postId: integer()
      .references(() => posts.id, { onDelete: "cascade" })
      .notNull(),
    replacedBy: text()
      .references(() => user.id)
      .notNull(),
    // Media metadata of the archived video at replacement time.
    videoKey: text().notNull(),
    videoMetadata: json().$type<unknown>().notNull(),
  },
  (t) => [index("video_revisions_post_idx").on(t.postId)],
);
