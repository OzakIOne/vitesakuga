import {
  createServerFileRoute,
  readMultipartFormData,
} from "@tanstack/react-start/server";
import { json } from "@tanstack/react-start";
import { kysely } from "../../auth/db/kysely";
import {
  DbSchemaInsert,
  postsInsertSchema,
} from "../../auth/db/schema/sakuga.schema";
import {
  S3Client,
  ListBucketsCommand,
  ListObjectsV2Command,
  ListPartsCommand,
  PutObjectCommand,
} from "@aws-sdk/client-s3";
import { writeFile } from "node:fs/promises";

const cfclient = new S3Client({
  region: "auto",
  endpoint: process.env.CLOUDFLARE_R2,
  credentials: {
    accessKeyId: process.env.CLOUDFLARE_ACCESS_KEY!,
    secretAccessKey: process.env.CLOUDFLARE_SECRET_KEY!,
  },
});

export const ServerRoute = createServerFileRoute("/api/posts").methods({
  POST: async ({ request }) => {
    const formData = await request.formData();
    console.log("Creating post... @", { url: request.url, formData });
    const file = formData.get("video")!;
    if (!(file instanceof File)) {
      throw new Error("Uploaded video is missing or invalid");
    }
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const userId = formData.get("userId");

    const command = new PutObjectCommand({
      Bucket: process.env.CLOUDFLARE_BUCKET,
      Key: `${userId}_${file.name}`,
      Body: buffer,
      ContentType: "application/octet-stream", // or e.g. "image/png", "text/plain"
    });
    const cfcmd = await cfclient.send(command);

    const newPost = await kysely
      .insertInto("posts")
      .values({
        title: formData.get("title")?.toString()!,
        content: formData.get("content")?.toString()!,
        userId: formData.get("userId")?.toString()!,
        key: formData.get("key")?.toString()!,
      })
      .returningAll()
      .executeTakeFirstOrThrow();

    if (cfcmd.$metadata.httpStatusCode !== 200) {
      throw new Error("There was an error uploading file");
    }

    return newPost;
  },
});
