import { Effect, Layer } from "effect";

import { StorageError, StorageModule } from "./storage.module";

const RUSTFS_ENDPOINT = "http://localhost:9000";
const RUSTFS_ACCESS_KEY = "rustfsadmin";
const RUSTFS_SECRET_KEY = "rustfsadmin";
const BUCKET = "e2e-test";

export const makeRustFSStorageLayer = () => {
  const layer = Layer.effect(
    StorageModule,
    Effect.gen(function* () {
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
        endpoint: RUSTFS_ENDPOINT,
        region: "us-east-1",
        credentials: {
          accessKeyId: RUSTFS_ACCESS_KEY,
          secretAccessKey: RUSTFS_SECRET_KEY,
        },
        forcePathStyle: true,
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
                  Bucket: BUCKET,
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

          return { key };
        });

      return {
        deleteFile: (key) =>
          Effect.gen(function* () {
            yield* Effect.tryPromise({
              try: () =>
                client.send(
                  new s3Mod.DeleteObjectCommand({
                    Bucket: BUCKET,
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

  return { layer } as const;
};
