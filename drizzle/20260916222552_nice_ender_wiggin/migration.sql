CREATE TABLE "media_objects" (
	"contentLength" integer NOT NULL,
	"contentType" text NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"deletingCommittedAt" timestamp,
	"fence" integer NOT NULL,
	"fingerprint" text NOT NULL,
	"key" text PRIMARY KEY,
	"kind" text NOT NULL,
	"operationId" text NOT NULL,
	"state" text DEFAULT 'reserved' NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL,
	"userId" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "media_operations" (
	"completedAt" timestamp,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"failureCode" text,
	"fence" integer DEFAULT 1 NOT NULL,
	"id" text PRIMARY KEY,
	"kind" text NOT NULL,
	"operationKey" text NOT NULL,
	"requestFingerprint" text NOT NULL,
	"result" json,
	"status" text DEFAULT 'in-progress' NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL,
	"userId" text NOT NULL
);
--> statement-breakpoint
ALTER TABLE "post_edits" ADD COLUMN "basePostVersion" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "posts" ADD COLUMN "version" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
CREATE INDEX "media_objects_operation_idx" ON "media_objects" ("operationId");--> statement-breakpoint
CREATE INDEX "media_objects_state_updated_idx" ON "media_objects" ("state","updatedAt");--> statement-breakpoint
CREATE INDEX "media_objects_user_idx" ON "media_objects" ("userId","createdAt");--> statement-breakpoint
CREATE UNIQUE INDEX "media_operations_user_key_unique" ON "media_operations" ("userId","operationKey");--> statement-breakpoint
CREATE INDEX "media_operations_status_updated_idx" ON "media_operations" ("status","updatedAt");--> statement-breakpoint
CREATE INDEX "media_operations_user_idx" ON "media_operations" ("userId","createdAt");--> statement-breakpoint
ALTER TABLE "media_objects" ADD CONSTRAINT "media_objects_operationId_media_operations_id_fkey" FOREIGN KEY ("operationId") REFERENCES "media_operations"("id");--> statement-breakpoint
ALTER TABLE "media_objects" ADD CONSTRAINT "media_objects_userId_user_id_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id");--> statement-breakpoint
ALTER TABLE "media_operations" ADD CONSTRAINT "media_operations_userId_user_id_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id");