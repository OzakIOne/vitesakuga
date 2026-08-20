CREATE TABLE "rateLimit" (
	"id" text PRIMARY KEY,
	"key" text NOT NULL,
	"count" integer NOT NULL,
	"lastRequest" bigint NOT NULL
);
--> statement-breakpoint
CREATE INDEX "rateLimit_key_idx" ON "rateLimit" ("key");