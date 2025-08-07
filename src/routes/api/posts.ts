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
    await writeFile(`${userId}_` + file.name, buffer);

    // const command = new PutObjectCommand({
    //   Bucket: process.env.CLOUDFLARE_BUCKET,
    //   Key: `${entries.userId}/${entries.video.name}`, // the name of the file in the bucket
    //   Body: entries.video,
    //   ContentType: "application/octet-stream", // or e.g. "image/png", "text/plain"
    // });

    // const command = new ListObjectsV2Command({
    //   Bucket: "vitesakuga",
    // });

    // const cloudflare = (await cfclient.send(command)).Contents;

    // const parsed = postsInsertSchema.safeParse(data);

    // if (!parsed.success)
    //   throw new Error("There was an error processing the search results", {
    //     cause: parsed.error,
    //   });

    // const newPost = await kysely
    //   .insertInto("posts")
    //   .values({ ...parsed.data })
    //   .returningAll()
    //   .executeTakeFirstOrThrow();

    return { lol: "xd" };
  },
});
