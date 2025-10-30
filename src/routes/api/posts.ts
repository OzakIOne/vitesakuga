import { PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { createFileRoute } from "@tanstack/react-router";
import { kysely } from "src/lib/db/kysely";
import { postsInsertSchema } from "src/lib/db/schema/sakuga.utils";
import z from "zod";

const cfclient = new S3Client({
  region: "auto",
  endpoint: process.env.CLOUDFLARE_R2,
  credentials: {
    accessKeyId: process.env.CLOUDFLARE_ACCESS_KEY!,
    secretAccessKey: process.env.CLOUDFLARE_SECRET_KEY!,
  },
});

export const TagSchema = z.object({
  id: z.number().optional(),
  name: z.string().min(1),
});

export const uploadSchema = postsInsertSchema.extend({
  video: z.file(),
  tags: z.array(TagSchema),
});

export const Route = createFileRoute("/api/posts")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const formData = await request.formData();

        const data: Record<string, any> = {};
        for (const [key, value] of formData.entries()) {
          if (key === "tags") {
            data[key] = JSON.parse(value as string);
          } else {
            data[key] = value;
          }
        }

        const parsed = uploadSchema.safeParse(data);
        if (!parsed.success) throw new Error(`Error: ${parsed.error}`);

        const key = `${parsed.data.userId}_${parsed.data.video.name}`;
        const command = new PutObjectCommand({
          Bucket: process.env.CLOUDFLARE_BUCKET,
          Key: key,
          Body: Buffer.from(await parsed.data.video.arrayBuffer()),
          ContentType: "application/octet-stream",
        });

        const cfcmd = await cfclient.send(command);
        if (cfcmd.$metadata.httpStatusCode !== 200)
          throw new Error("There was an error uploading file");

        // Create post
        const newPost = await kysely
          .insertInto("posts")
          .values({
            content: parsed.data.content,
            title: parsed.data.title,
            userId: parsed.data.userId,
            key,
            source: parsed.data.source || null,
            relatedPostId: parsed.data.relatedPostId
              ? Number(parsed.data.relatedPostId)
              : null,
          })
          .returningAll()
          .executeTakeFirstOrThrow();

        const postId = newPost.id;

        if (parsed.data.tags && parsed.data.tags.length > 0) {
          // Process each tag - create new ones and collect all tag IDs
          const allTagIds: number[] = [];

          for (const tag of parsed.data.tags) {
            if (tag.id !== undefined) {
              allTagIds.push(tag.id);
            } else {
              // Create new tag with conflict handling
              const newTag = await kysely
                .insertInto("tags")
                .values({ name: tag.name })
                .onConflict((oc) =>
                  oc.column("name").doUpdateSet({ name: tag.name })
                )
                .returning("id")
                .executeTakeFirstOrThrow();
              allTagIds.push(newTag.id);
            }
          }

          // Link post to tags
          if (allTagIds.length > 0) {
            await kysely
              .insertInto("post_tags")
              .values(
                allTagIds.map((tagId) => ({
                  postId,
                  tagId,
                }))
              )
              .execute();
          }
        }

        return newPost;
      },
    },
  },
});
