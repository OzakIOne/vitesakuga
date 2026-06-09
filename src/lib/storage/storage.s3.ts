import { Effect, Layer } from "effect";

import { StorageError, StorageModule } from "./storage.module";

export const StorageLive = Layer.effect(
  StorageModule,
  Effect.gen(function* () {
    const { envServer } = yield* Effect.tryPromise({
      try: () => import("../env/server"),
      catch: (cause) =>
        new StorageError({
          cause,
          key: "",
          message: `Failed to load environment: ${String(cause)}`,
          operation: "upload",
        }),
    });

    const s3Mod = yield* Effect.tryPromise({
      try: () => import("@aws-sdk/client-s3"),
      catch: (cause) =>
        new StorageError({
          cause,
          key: "",
          message: `Failed to load S3 client: ${String(cause)}`,
          operation: "upload",
        }),
    });

    const client = new s3Mod.S3Client({
      credentials: {
        accessKeyId: envServer.CLOUDFLARE_ACCESS_KEY,
        secretAccessKey: envServer.CLOUDFLARE_SECRET_KEY,
      },
      endpoint: envServer.CLOUDFLARE_R2,
      region: "auto",
    });

    const uploadFile = (
      namespace: string,
      userId: string,
      file: File,
      ext: string,
    ): Effect.Effect<{ key: string }, StorageError> =>
      Effect.gen(function* () {
        const baseName = crypto.randomUUID();
        const key = `${namespace}/${userId}/${baseName}.${ext}`;

        const buffer = yield* Effect.tryPromise({
          try: () => file.arrayBuffer(),
          catch: (cause) =>
            new StorageError({
              cause,
              key,
              message: `Failed to read file: ${String(cause)}`,
              operation: "upload",
            }),
        });

        const result = yield* Effect.tryPromise({
          try: () =>
            client.send(
              new s3Mod.PutObjectCommand({
                Body: Buffer.from(buffer),
                Bucket: envServer.CLOUDFLARE_BUCKET,
                ContentType: file.type,
                Key: key,
              }),
            ),
          catch: (cause) =>
            new StorageError({
              cause,
              key,
              message: `Upload failed: ${String(cause)}`,
              operation: "upload",
            }),
        });

        if (result.$metadata.httpStatusCode !== 200) {
          return yield* Effect.fail(
            new StorageError({
              cause: result.$metadata,
              key,
              message: `Upload failed with status ${result.$metadata.httpStatusCode}`,
              operation: "upload",
            }),
          );
        }

        yield* Effect.logInfo("File uploaded to R2").pipe(
          Effect.annotateLogs("key", key),
        );

        return { key };
      });

    return {
      deleteFile: (key) =>
        Effect.gen(function* () {
          yield* Effect.tryPromise({
            try: () =>
              client.send(
                new s3Mod.DeleteObjectCommand({
                  Bucket: envServer.CLOUDFLARE_BUCKET,
                  Key: key,
                }),
              ),
            catch: (cause) =>
              new StorageError({
                cause,
                key,
                message: `Delete failed: ${String(cause)}`,
                operation: "delete",
              }),
          });

          yield* Effect.logInfo("File deleted from R2").pipe(
            Effect.annotateLogs("key", key),
          );
        }),
      uploadThumbnail: (userId, file) =>
        uploadFile("thumbnails", userId, file, "jpg"),
      uploadVideo: (userId, file) => {
        const ext = file.name.split(".").pop() ?? "mp4";
        return uploadFile("videos", userId, file, ext);
      },
    } satisfies StorageModule["Service"];
  }),
);
