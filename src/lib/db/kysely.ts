import type { Generated } from "kysely";
import { Kysely, PostgresDialect } from "kysely";
import { Pool as PgPool } from "pg";

import { getKyselyPool } from "./pool";

type UserTable = {
  id: string;
  name: string;
  email: string;
  emailVerified: boolean;
  image: string | null;
  createdAt: Generated<Date>;
  updatedAt: Generated<Date>;
};

type SessionTable = {
  id: string;
  token: string;
  userId: string;
  expiresAt: Date;
  ipAddress: string | null;
  userAgent: string | null;
  createdAt: Date;
  updatedAt: Date;
};

type AccountTable = {
  id: string;
  userId: string;
  accountId: string;
  providerId: string;
  accessToken: string | null;
  refreshToken: string | null;
  idToken: string | null;
  accessTokenExpiresAt: Date | null;
  refreshTokenExpiresAt: Date | null;
  scope: string | null;
  password: string | null;
  createdAt: Date;
  updatedAt: Date;
};

type VerificationTable = {
  id: string;
  identifier: string;
  value: string;
  expiresAt: Date;
  createdAt: Date | null;
  updatedAt: Date | null;
};

type TagsTable = {
  id: Generated<number>;
  name: string;
  createdAt: Generated<Date>;
};

type PostTagsTable = {
  postId: number;
  tagId: number;
};

type PostsTable = {
  id: Generated<number>;
  content: string;
  createdAt: Generated<Date>;
  relatedPostId: number | null;
  source: string | null;
  thumbnailKey: string;
  title: string;
  userId: string;
  videoKey: string;
  videoMetadata: string;
};

type PlaylistsTable = {
  id: Generated<number>;
  created_at: Generated<Date>;
  description: string | null;
  is_public: Generated<boolean>;
  title: string;
  updated_at: Generated<Date>;
  user_id: string;
};

type PlaylistPostsTable = {
  playlist_id: number;
  post_id: number;
  position: Generated<number>;
  created_at: Generated<Date>;
};

type CommentsTable = {
  id: Generated<number>;
  content: string;
  createdAt: Generated<Date>;
  postId: number;
  userId: string;
};

export type DB = {
  account: AccountTable;
  session: SessionTable;
  user: UserTable;
  verification: VerificationTable;
  comments: CommentsTable;
  post_tags: PostTagsTable;
  posts: PostsTable;
  tags: TagsTable;
  playlists: PlaylistsTable;
  playlist_posts: PlaylistPostsTable;
};

export const kysely = new Kysely<DB>({
  dialect: new PostgresDialect({
    pool: getKyselyPool() as PgPool,
  }),
});
