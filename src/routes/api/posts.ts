import { createFileRoute } from "@tanstack/react-router";
import { kysely } from "../../auth/db/kysely";
import { postsInsertSchema } from "../../auth/db/schema/sakuga.schema";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import z from "zod";

const cfclient = new S3Client({
  region: "auto",
  endpoint: process.env.CLOUDFLARE_R2,
  credentials: {
    accessKeyId: process.env.CLOUDFLARE_ACCESS_KEY!,
    secretAccessKey: process.env.CLOUDFLARE_SECRET_KEY!,
  },
});

export const uploadSchema = postsInsertSchema.extend({
  video: z.file(),
});

export const Route = createFileRoute("/api/posts")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const data = Object.fromEntries((await request.formData()).entries());
        const parsed = uploadSchema.safeParse(data);
        console.log("Creating post... @", {
          url: request.url,
          data: parsed.data,
        });
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

        const newPost = await kysely
          .insertInto("posts")
          .values({
            content: parsed.data.content,
            title: parsed.data.title,
            userId: parsed.data.userId,
            key,
          })
          .returningAll()
          .executeTakeFirstOrThrow();

        return newPost;
      },
    },
  },
});
