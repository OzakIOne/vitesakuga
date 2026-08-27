import { neon } from "@neondatabase/serverless";
import type { Generated } from "kysely";
import { Kysely, PostgresDialect } from "kysely";
import { Pool as PgPool } from "pg";

import { envServer } from "../env/server";
import { NeonTransactionDialect } from "./neon-transaction-dialect";
import { getKyselyPool, isLocal } from "./pool";

type UserTable = {
  id: string;
  name: string;
  email: string;
  emailVerified: boolean;
  image: string | null;
  twoFactorEnabled: boolean;
  // Rank behind the authorization policies (src/lib/auth/policy.ts).
  role: string;
  deletedAt: Date | null;
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

// Written/read by Better Auth's two-factor plugin.
type TwoFactorTable = {
  id: string;
  userId: string;
  secret: string;
  backupCodes: string;
  verified: boolean;
  failedVerificationCount: number;
  lockedUntil: Date | null;
};

// Written/read by @better-auth/passkey.
type PasskeyTable = {
  id: string;
  userId: string;
  credentialID: string;
  publicKey: string;
  counter: number;
  backedUp: boolean;
  deviceType: string;
  transports: string | null;
  aaguid: string | null;
  name: string | null;
  createdAt: Date | null;
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
  animeTitle: string | null;
  content: string;
  createdAt: Generated<Date>;
  episodeNumber: number | null;
  relatedPostId: number | null;
  seasonNumber: number | null;
  source: string | null;
  sourceType: "movie" | "tv_series" | null;
  thumbnailKey: string;
  title: string;
  userId: string;
  videoKey: string | null;
  videoMetadata: string;
};

type PostImagesTable = {
  createdAt: Generated<Date>;
  postId: number;
  position: number;
  storageKey: string;
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

type PostVotesTable = {
  createdAt: Generated<Date>;
  postId: number;
  userId: string;
  vote: "like" | "dislike";
};

type PostReportsTable = {
  createdAt: Generated<Date>;
  postId: number;
  reason: "duplicate" | "poor_quality" | "unrelated";
  userId: string;
};

type PointsLedgerTable = {
  id: Generated<number>;
  userId: string;
  action:
    | "comment-written"
    | "edit-suggestion-approved"
    | "post-like-received"
    | "post-upload";
  points: number;
  refId: number | null;
  actorId: string | null;
  createdAt: Generated<Date>;
};

type PromotionReviewsTable = {
  id: Generated<number>;
  userId: string;
  status: "approved" | "rejected";
  pointsAtReview: number;
  reviewedBy: string | null;
  createdAt: Generated<Date>;
};

type VideoRevisionsTable = {
  id: Generated<number>;
  postId: number;
  replacedBy: string;
  videoKey: string;
  videoMetadata: unknown;
  createdAt: Generated<Date>;
};

type PostEditsTable = {
  id: Generated<number>;
  postId: number;
  suggestedBy: string;
  status: "approved" | "pending" | "rejected";
  // json column: the driver returns the parsed object; validated by
  // decodePostEditPayload before use. Shape mirrors post-edits.schema.
  payload: {
    readonly animeTitle?: string | null;
    readonly content?: string;
    readonly episodeNumber?: number | null;
    readonly seasonNumber?: number | null;
    readonly source?: string | null;
    readonly title?: string;
  };
  resolvedAt: Date | null;
  resolvedBy: string | null;
  createdAt: Generated<Date>;
};

type PostEditApprovalsTable = {
  editId: number;
  userId: string;
  createdAt: Generated<Date>;
};

type NotificationsTable = {
  id: Generated<number>;
  userId: string;
  type: "edit-suggestion-applied" | "promotion-approved" | "promotion-rejected";
  readAt: Date | null;
  createdAt: Generated<Date>;
};

export type DB = {
  account: AccountTable;
  session: SessionTable;
  user: UserTable;
  verification: VerificationTable;
  twoFactor: TwoFactorTable;
  passkey: PasskeyTable;
  comments: CommentsTable;
  post_votes: PostVotesTable;
  post_reports: PostReportsTable;
  post_images: PostImagesTable;
  post_tags: PostTagsTable;
  points_ledger: PointsLedgerTable;
  posts: PostsTable;
  post_edits: PostEditsTable;
  post_edit_approvals: PostEditApprovalsTable;
  video_revisions: VideoRevisionsTable;
  promotion_reviews: PromotionReviewsTable;
  notifications: NotificationsTable;
  tags: TagsTable;
  playlists: PlaylistsTable;
  playlist_posts: PlaylistPostsTable;
};

export const kysely = isLocal
  ? new Kysely<DB>({
      dialect: new PostgresDialect({
        // SAFETY: getKyselyPool() creates a PgPool exactly when DATABASE_DRIVER=local
        // (isLocal), so this pool is always the PgPool PostgresDialect requires.
        pool: getKyselyPool() as PgPool,
      }),
    })
  : new Kysely<DB>({
      dialect: new NeonTransactionDialect({
        neon: neon(envServer.DATABASE_URL),
        connectionString: envServer.DATABASE_URL,
      }),
    });
