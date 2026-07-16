CREATE TABLE "playlist_posts" (
	"playlist_id" integer NOT NULL,
	"post_id" integer NOT NULL,
	"position" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "playlists" (
	"created_at" timestamp DEFAULT now() NOT NULL,
	"description" text,
	"id" serial PRIMARY KEY NOT NULL,
	"is_public" boolean DEFAULT false NOT NULL,
	"title" text NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"user_id" text NOT NULL
);
--> statement-breakpoint
ALTER TABLE "playlist_posts" ADD CONSTRAINT "playlist_posts_playlist_id_playlists_id_fk" FOREIGN KEY ("playlist_id") REFERENCES "public"."playlists"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "playlists" ADD CONSTRAINT "playlists_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "unique_playlist_post" ON "playlist_posts" USING btree ("playlist_id","post_id");