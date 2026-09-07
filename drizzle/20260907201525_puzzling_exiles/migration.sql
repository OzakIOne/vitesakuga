CREATE TABLE "tag_follows" (
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"tagId" integer,
	"userId" text,
	CONSTRAINT "tag_follows_pkey" PRIMARY KEY("userId","tagId")
);
--> statement-breakpoint
CREATE INDEX "tag_follows_user_idx" ON "tag_follows" ("userId","createdAt");--> statement-breakpoint
ALTER TABLE "tag_follows" ADD CONSTRAINT "tag_follows_tagId_tags_id_fkey" FOREIGN KEY ("tagId") REFERENCES "tags"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "tag_follows" ADD CONSTRAINT "tag_follows_userId_user_id_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE;