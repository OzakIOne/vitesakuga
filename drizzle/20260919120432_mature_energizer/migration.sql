ALTER TABLE "media_objects" ALTER COLUMN "createdAt" SET DATA TYPE timestamp with time zone USING "createdAt"::timestamp with time zone;--> statement-breakpoint
ALTER TABLE "media_objects" ALTER COLUMN "deletingCommittedAt" SET DATA TYPE timestamp with time zone USING "deletingCommittedAt"::timestamp with time zone;--> statement-breakpoint
ALTER TABLE "media_objects" ALTER COLUMN "updatedAt" SET DATA TYPE timestamp with time zone USING "updatedAt"::timestamp with time zone;--> statement-breakpoint
ALTER TABLE "media_operations" ALTER COLUMN "completedAt" SET DATA TYPE timestamp with time zone USING "completedAt"::timestamp with time zone;--> statement-breakpoint
ALTER TABLE "media_operations" ALTER COLUMN "createdAt" SET DATA TYPE timestamp with time zone USING "createdAt"::timestamp with time zone;--> statement-breakpoint
ALTER TABLE "media_operations" ALTER COLUMN "updatedAt" SET DATA TYPE timestamp with time zone USING "updatedAt"::timestamp with time zone;