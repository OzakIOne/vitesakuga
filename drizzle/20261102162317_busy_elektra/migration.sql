CREATE TABLE "account_moderation_events" (
	"actorUserId" text,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL,
	"id" serial PRIMARY KEY,
	"kind" text NOT NULL,
	"newRole" text,
	"previousRole" text,
	"reason" text,
	"targetUserId" text,
	CONSTRAINT "account_moderation_events_kind_check" CHECK ("kind" IN ('role-changed', 'suspended', 'unsuspended')),
	CONSTRAINT "account_moderation_events_previous_role_check" CHECK ("previousRole" IS NULL OR "previousRole" IN ('novice', 'uploader', 'moderator', 'admin')),
	CONSTRAINT "account_moderation_events_new_role_check" CHECK ("newRole" IS NULL OR "newRole" IN ('novice', 'uploader', 'moderator', 'admin')),
	CONSTRAINT "account_moderation_events_role_shape_check" CHECK (("kind" = 'role-changed' AND "previousRole" IS NOT NULL AND "newRole" IS NOT NULL) OR ("kind" <> 'role-changed' AND "previousRole" IS NULL AND "newRole" IS NULL))
);
--> statement-breakpoint
CREATE INDEX "account_moderation_events_target_created_at_idx" ON "account_moderation_events" ("targetUserId","createdAt");--> statement-breakpoint
ALTER TABLE "account_moderation_events" ADD CONSTRAINT "account_moderation_events_actorUserId_user_id_fkey" FOREIGN KEY ("actorUserId") REFERENCES "user"("id") ON DELETE SET NULL;--> statement-breakpoint
ALTER TABLE "account_moderation_events" ADD CONSTRAINT "account_moderation_events_targetUserId_user_id_fkey" FOREIGN KEY ("targetUserId") REFERENCES "user"("id") ON DELETE SET NULL;