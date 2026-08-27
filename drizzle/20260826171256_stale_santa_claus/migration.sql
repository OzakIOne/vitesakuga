CREATE TABLE "notifications" (
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"id" serial PRIMARY KEY,
	"readAt" timestamp,
	"type" text NOT NULL,
	"userId" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "promotion_reviews" (
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"id" serial PRIMARY KEY,
	"pointsAtReview" integer NOT NULL,
	"reviewedBy" text,
	"status" text NOT NULL,
	"userId" text NOT NULL
);
--> statement-breakpoint
CREATE INDEX "notifications_user_idx" ON "notifications" ("userId","createdAt");--> statement-breakpoint
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_userId_user_id_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "promotion_reviews" ADD CONSTRAINT "promotion_reviews_userId_user_id_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE;