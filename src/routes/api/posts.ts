import { createFileRoute } from "@tanstack/react-router";
import { postsInsertSchema } from "src/lib/db/schema/sakuga.utils";
import z from "zod";

export const TagSchema = z.object({
  id: z.number().optional(),
  name: z.string().min(1),
});

const SerializableFileSchema = z.object({
  arrayBuffer: z.instanceof(ArrayBuffer),
  name: z.string(),
  type: z.string(),
  size: z.number(),
});

export const uploadSchema = postsInsertSchema.extend({
  video: z.union([z.file(), SerializableFileSchema]),
  tags: z.array(TagSchema),
});

export const Route = createFileRoute("/api/posts")({});
