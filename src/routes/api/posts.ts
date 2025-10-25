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

        const data: any = {};
        const tagIds: number[] = [];
        const newTags: string[] = [];

        for (const [key, value] of formData.entries()) {
          if (key === "tagIds[]") {
            tagIds.push(Number(value));
          } else if (key === "newTags[]") {
            newTags.push(value as string);
          } else {
            data[key] = value;
          }
        }

        data.tags = [
          ...tagIds.map((id) => ({ id })),
          ...newTags.map((name) => ({ name })),
        ];

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

        // 7️⃣ Separate existing tag IDs vs new tags
        const existingTagIds = parsed.data.tags
          .filter((t) => t.id !== undefined)
          .map((t) => t.id!) as number[];
        const newTagNames = parsed.data.tags
          .filter((t) => t.id === undefined)
          .map((t) => t.name);

        const allTagIds: number[] = [...existingTagIds];

        // Insert new tags (with conflict handling)
        for (const name of newTagNames) {
          try {
            const tag = await kysely
              .insertInto("tags")
              .values({ name })
              .onConflict((oc) => oc.column("name").doUpdateSet({ name }))
              .returning("id")
              .executeTakeFirstOrThrow();
            allTagIds.push(tag.id);
          } catch {
            // If conflict resolution fails, try to fetch existing tag
            const existingTag = await kysely
              .selectFrom("tags")
              .select("id")
              .where("name", "=", name)
              .executeTakeFirst();

            if (existingTag) {
              allTagIds.push(existingTag.id);
            }
          }
        }

        // Link post to tags
        if (allTagIds.length > 0) {
          await kysely
            .insertInto("postTags")
            .values(
              allTagIds.map((tagId) => ({
                postId,
                tagId,
              }))
            )
            .execute();
        }

        return newPost;
      },
    },
  },
});
