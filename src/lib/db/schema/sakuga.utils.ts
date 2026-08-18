import { Schema } from "effect";

import type { userInsertSchema, userSelectSchema } from "./auth.schema";
import { TimestampSchema } from "./timestamp";

export const tagsSelectSchema = Schema.Struct({
  createdAt: TimestampSchema,
  id: Schema.Number,
  name: Schema.String,
});

export const tagsInsertSchema = Schema.Struct({
  createdAt: Schema.optionalKey(Schema.Date),
  id: Schema.optionalKey(Schema.Number),
  name: Schema.String,
});

export const postsSelectSchema = Schema.Struct({
  content: Schema.String,
  createdAt: TimestampSchema,
  id: Schema.Number,
  relatedPostId: Schema.NullOr(Schema.Number),
  source: Schema.NullOr(Schema.String),
  thumbnailKey: Schema.String,
  title: Schema.String,
  userId: Schema.String,
  videoKey: Schema.String,
  videoMetadata: Schema.Json,
});

export const postsInsertSchema = Schema.Struct({
  content: Schema.String,
  createdAt: Schema.optionalKey(Schema.Date),
  id: Schema.optionalKey(Schema.Number),
  relatedPostId: Schema.optionalKey(Schema.NullOr(Schema.Number)),
  source: Schema.optionalKey(Schema.NullOr(Schema.String)),
  thumbnailKey: Schema.String,
  title: Schema.String,
  userId: Schema.String,
  videoKey: Schema.String,
  videoMetadata: Schema.Json,
});

export const postVoteSchema = Schema.Literals(["like", "dislike"]);

export type PostVote = Schema.Schema.Type<typeof postVoteSchema>;

export const postVotesSelectSchema = Schema.Struct({
  createdAt: TimestampSchema,
  postId: Schema.Number,
  userId: Schema.String,
  vote: postVoteSchema,
});

export const postVotesInsertSchema = Schema.Struct({
  createdAt: Schema.optionalKey(Schema.Date),
  postId: Schema.Number,
  userId: Schema.String,
  vote: postVoteSchema,
});

export const postWithVotesSelectSchema = Schema.Struct({
  ...postsSelectSchema.fields,
  dislikes: Schema.Number,
  likes: Schema.Number,
});

export type PostWithVotes = Schema.Schema.Type<
  typeof postWithVotesSelectSchema
>;

export const commentsSelectSchema = Schema.Struct({
  content: Schema.String,
  createdAt: TimestampSchema,
  id: Schema.Number,
  postId: Schema.Number,
  userId: Schema.String,
});

export const commentsInsertSchema = Schema.Struct({
  content: Schema.String,
  createdAt: Schema.optionalKey(Schema.Date),
  id: Schema.optionalKey(Schema.Number),
  postId: Schema.Number,
  userId: Schema.String,
});

export const playlistsSelectSchema = Schema.Struct({
  created_at: TimestampSchema,
  description: Schema.NullOr(Schema.String),
  id: Schema.Number,
  is_public: Schema.Boolean,
  title: Schema.String,
  updated_at: TimestampSchema,
  user_id: Schema.String,
});

export const playlistsInsertSchema = Schema.Struct({
  created_at: Schema.optionalKey(Schema.Date),
  description: Schema.optionalKey(Schema.NullOr(Schema.String)),
  id: Schema.optionalKey(Schema.Number),
  is_public: Schema.optionalKey(Schema.Boolean),
  title: Schema.String,
  updated_at: Schema.optionalKey(Schema.Date),
  user_id: Schema.String,
});

export const playlistPostsSelectSchema = Schema.Struct({
  created_at: TimestampSchema,
  playlist_id: Schema.Number,
  position: Schema.Number,
  post_id: Schema.Number,
});

export const playlistPostsInsertSchema = Schema.Struct({
  created_at: Schema.optionalKey(Schema.Date),
  playlist_id: Schema.Number,
  position: Schema.optionalKey(Schema.Number),
  post_id: Schema.Number,
});

type UserSelect = Schema.Schema.Type<typeof userSelectSchema>;
type PostsSelect = Schema.Schema.Type<typeof postsSelectSchema>;
type CommentsSelect = Schema.Schema.Type<typeof commentsSelectSchema>;
type TagsSelect = Schema.Schema.Type<typeof tagsSelectSchema>;

export type DbSchemaSelect = {
  user: UserSelect;
  posts: PostsSelect;
  postVotes: Schema.Schema.Type<typeof postVotesSelectSchema>;
  comments: CommentsSelect;
  tags: TagsSelect;
  playlists: Schema.Schema.Type<typeof playlistsSelectSchema>;
  playlistPosts: Schema.Schema.Type<typeof playlistPostsSelectSchema>;
};

type UserInsert = Schema.Schema.Type<typeof userInsertSchema>;
type PostsInsert = Schema.Schema.Type<typeof postsInsertSchema>;
type CommentsInsert = Schema.Schema.Type<typeof commentsInsertSchema>;
type TagsInsert = Schema.Schema.Type<typeof tagsInsertSchema>;

export type DbSchemaInsert = {
  user: UserInsert;
  posts: PostsInsert;
  postVotes: Schema.Schema.Type<typeof postVotesInsertSchema>;
  comments: CommentsInsert;
  tags: TagsInsert;
  playlists: Schema.Schema.Type<typeof playlistsInsertSchema>;
  playlistPosts: Schema.Schema.Type<typeof playlistPostsInsertSchema>;
};
