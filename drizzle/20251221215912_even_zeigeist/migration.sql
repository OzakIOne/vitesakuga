CREATE TABLE "account" (
	"accessToken" text,
	"accessTokenExpiresAt" timestamp,
	"accountId" text NOT NULL,
	"createdAt" timestamp NOT NULL,
	"id" text PRIMARY KEY NOT NULL,
	"idToken" text,
	"password" text,
	"providerId" text NOT NULL,
	"refreshToken" text,
	"refreshTokenExpiresAt" timestamp,
	"scope" text,
	"updatedAt" timestamp NOT NULL,
	"userId" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "session" (
	"createdAt" timestamp NOT NULL,
	"expiresAt" timestamp NOT NULL,
	"id" text PRIMARY KEY NOT NULL,
	"ipAddress" text,
	"token" text NOT NULL,
	"updatedAt" timestamp NOT NULL,
	"userAgent" text,
	"userId" text NOT NULL,
	CONSTRAINT "session_token_unique" UNIQUE("token")
);
--> statement-breakpoint
CREATE TABLE "user" (
	"createdAt" timestamp NOT NULL,
	"email" text NOT NULL,
	"emailVerified" boolean NOT NULL,
	"id" text PRIMARY KEY NOT NULL,
	"image" text,
	"name" text NOT NULL,
	"updatedAt" timestamp NOT NULL,
	CONSTRAINT "user_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "verification" (
	"createdAt" timestamp,
	"expiresAt" timestamp NOT NULL,
	"id" text PRIMARY KEY NOT NULL,
	"identifier" text NOT NULL,
	"updatedAt" timestamp,
	"value" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "comments" (
	"content" text NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"id" serial PRIMARY KEY NOT NULL,
	"postId" bigint NOT NULL,
	"userId" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "post_tags" (
	"postId" integer NOT NULL,
	"tagId" integer NOT NULL,
	CONSTRAINT "post_tags_postId_tagId_pk" PRIMARY KEY("postId","tagId")
);
--> statement-breakpoint
CREATE TABLE "posts" (
	"content" text NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"id" serial PRIMARY KEY NOT NULL,
	"relatedPostId" integer,
	"source" text,
	"thumbnailKey" text NOT NULL,
	"title" text NOT NULL,
	"userId" text NOT NULL,
	"videoKey" text NOT NULL,
	"videoMetadata" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "tags" (
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	CONSTRAINT "tags_name_unique" UNIQUE("name")
);
--> statement-breakpoint
ALTER TABLE "account" ADD CONSTRAINT "account_userId_user_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "session" ADD CONSTRAINT "session_userId_user_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "comments" ADD CONSTRAINT "comments_postId_posts_id_fk" FOREIGN KEY ("postId") REFERENCES "public"."posts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "comments" ADD CONSTRAINT "comments_userId_user_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "post_tags" ADD CONSTRAINT "post_tags_postId_posts_id_fk" FOREIGN KEY ("postId") REFERENCES "public"."posts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "post_tags" ADD CONSTRAINT "post_tags_tagId_tags_id_fk" FOREIGN KEY ("tagId") REFERENCES "public"."tags"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "posts" ADD CONSTRAINT "posts_userId_user_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;