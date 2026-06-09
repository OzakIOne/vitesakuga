ALTER TABLE "user" ALTER COLUMN "createdAt" SET DEFAULT now();
--> statement-breakpoint
ALTER TABLE "user" ALTER COLUMN "updatedAt" SET DEFAULT now();
--> statement-breakpoint
ALTER TABLE "user" ALTER COLUMN "emailVerified" SET DEFAULT false;
--> statement-breakpoint
ALTER TABLE "posts" ALTER COLUMN "createdAt" SET DEFAULT now();
--> statement-breakpoint
ALTER TABLE "posts" ALTER COLUMN "videoMetadata" SET DEFAULT '{}';
--> statement-breakpoint
ALTER TABLE "tags" ALTER COLUMN "createdAt" SET DEFAULT now();