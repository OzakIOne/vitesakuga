ALTER TABLE "media_objects" ADD CONSTRAINT "media_objects_kind_check" CHECK ("kind" IN ('video', 'image', 'thumbnail'));--> statement-breakpoint
ALTER TABLE "media_objects" ADD CONSTRAINT "media_objects_state_check" CHECK ("state" IN ('reserved', 'preparing', 'ready', 'unknown', 'deleting', 'deleted'));--> statement-breakpoint
ALTER TABLE "media_objects" ADD CONSTRAINT "media_objects_fence_check" CHECK ("fence" > 0);--> statement-breakpoint
ALTER TABLE "media_objects" ADD CONSTRAINT "media_objects_content_length_check" CHECK ("contentLength" >= 0);--> statement-breakpoint
ALTER TABLE "media_operations" ADD CONSTRAINT "media_operations_status_check" CHECK ("status" IN ('in-progress', 'completed', 'conflict', 'failed', 'unknown'));--> statement-breakpoint
ALTER TABLE "media_operations" ADD CONSTRAINT "media_operations_fence_check" CHECK ("fence" > 0);