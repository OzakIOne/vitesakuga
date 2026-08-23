import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { Effect, Layer } from "effect";

import { THUMBNAIL_CONTENT_TYPE, videoContentType } from "./content-type";
import { PENDING_VIDEOS_PREFIX, finalizedVideoKey } from "./keys";
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
        // Presigned PUT URLs must not carry the SDK's default CRC32 checksum
        // query params: the checksum is computed over an unsigned payload and
        // would be rejected by the S3-compatible server against the real bytes.
        requestChecksumCalculation: "WHEN_REQUIRED",
      });

      const uploadFile = (
        namespace: string,
        userId: string,
        file: File,
        ext: string,
        contentType: string,
      ): Effect.Effect<{ key: string }, StorageError> =>
        Effect.gen(function* () {
          // oxlint-disable-next-line effecttsgo/crypto-random-uuid-in-effect -- object keys must be unpredictable; Effect's `Random` is Math.random-based and not cryptographically secure, so native WebCrypto is kept here
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
                  ContentType: contentType,
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
          uploadFile("thumbnails", userId, file, "jpg", THUMBNAIL_CONTENT_TYPE),
        uploadVideo: (userId, file) => {
          const ext = file.name.split(".").pop() ?? "mp4";
          return uploadFile("videos", userId, file, ext, videoContentType(ext));
        },
        headFile: (key) =>
          Effect.gen(function* () {
            const result = yield* Effect.tryPromise({
              try: () =>
                client.send(
                  new s3Mod.HeadObjectCommand({
                    Bucket: BUCKET,
                    Key: key,
                  }),
                ),
              catch: (cause) =>
                new StorageError({
                  cause,
                  key,
                  message: `Failed to inspect file: ${String(cause)}`,
                  operation: "head",
                }),
            });

            return {
              contentLength: result.ContentLength ?? 0,
              contentType: result.ContentType ?? "",
            };
          }),
        presignVideoUpload: (userId, ext) =>
          Effect.gen(function* () {
            // oxlint-disable-next-line effecttsgo/crypto-random-uuid-in-effect -- object keys must be unpredictable; Effect's `Random` is Math.random-based and not cryptographically secure, so native WebCrypto is kept here
            const baseName = crypto.randomUUID();
            // Presigned PUTs land in the staging namespace; only the confirm
            // step promotes validated objects to their final `videos/` key.
            const key = `${PENDING_VIDEOS_PREFIX}${userId}/${baseName}.${ext}`;
            const contentType = videoContentType(ext);

            const url = yield* Effect.tryPromise({
              try: () =>
                getSignedUrl(
                  client,
                  new s3Mod.PutObjectCommand({
                    Bucket: BUCKET,
                    ContentType: contentType,
                    Key: key,
                  }),
                  { expiresIn: 15 * 60 },
                ),
              catch: (cause) =>
                new StorageError({
                  cause,
                  key,
                  message: `Failed to presign upload: ${String(cause)}`,
                  operation: "presign",
                }),
            });

            return { contentType, key, url };
          }),
        finalizeVideoUpload: (pendingKey) =>
          Effect.gen(function* () {
            const finalKey = finalizedVideoKey(pendingKey);

            // SAFETY: CopySource is `${bucket}/${key}` with the key path
            // URL-encoded; the generated keys only ever contain UUIDs, a
            // whitelisted extension and `/` separators, so encoding each
            // segment is identity in practice and defensive by construction.
            const copySource = `${BUCKET}/${pendingKey
              .split("/")
              .map(encodeURIComponent)
              .join("/")}`;

            yield* Effect.tryPromise({
              try: () =>
                client.send(
                  new s3Mod.CopyObjectCommand({
                    Bucket: BUCKET,
                    CopySource: copySource,
                    Key: finalKey,
                  }),
                ),
              catch: (cause) =>
                new StorageError({
                  cause,
                  key: pendingKey,
                  message: `Failed to promote upload: ${String(cause)}`,
                  operation: "finalize",
                }),
            });

            // Best-effort cleanup of the staging copy; leftovers expire via
            // the bucket lifecycle rule, so promotion must not fail here.
            yield* Effect.ignore(
              Effect.tryPromise({
                try: () =>
                  client.send(
                    new s3Mod.DeleteObjectCommand({
                      Bucket: BUCKET,
                      Key: pendingKey,
                    }),
                  ),
                catch: (cause) =>
                  new StorageError({
                    cause,
                    key: pendingKey,
                    message: `Failed to clean up staged upload: ${String(cause)}`,
                    operation: "finalize",
                  }),
              }),
            );

            yield* Effect.logInfo("Pending upload promoted").pipe(
              Effect.annotateLogs({ finalKey }),
            );

            return { key: finalKey };
          }),
      } satisfies StorageModule["Service"];
    }),
  );

  return { layer } as const;
};
