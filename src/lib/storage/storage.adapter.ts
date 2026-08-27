import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { Effect, Layer, Redacted } from "effect";

import {
  THUMBNAIL_CONTENT_TYPE,
  imageContentType,
  videoContentType,
} from "./content-type";
import { PENDING_VIDEOS_PREFIX, finalizedVideoKey } from "./keys";
import { StorageError, StorageModule } from "./storage.module";

/**
 * Connection parameters for any store speaking the S3 protocol. The two
 * configurations shipped below are Cloudflare R2 (production, resolved from
 * the validated app environment) and RustFS (local Docker store used by the
 * service tests).
 */
type S3Connection = {
  readonly bucket: string;
  /** Human-readable store name for log lines (e.g. "R2", "RustFS"). */
  readonly label: string;
  readonly endpoint: string;
  readonly region: string;
  readonly credentials: {
    readonly accessKeyId: string;
    readonly secretAccessKey: string;
  };
  /** Path-style addressing for local S3-compatible stores (RustFS/MinIO). */
  readonly forcePathStyle: boolean;
};

/**
 * Build the storage service against a concrete S3-compatible endpoint. The
 * AWS SDK is loaded lazily inside the constructor so importing this module
 * never pulls the SDK into a bundle that does not build a layer from it.
 */
const makeS3StorageService = (connection: S3Connection) =>
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
      credentials: connection.credentials,
      endpoint: connection.endpoint,
      region: connection.region,
      forcePathStyle: connection.forcePathStyle,
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
                Bucket: connection.bucket,
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
          return yield* new StorageError({
            cause: result.$metadata,
            key,
            message: `Upload failed with status ${result.$metadata.httpStatusCode}`,
            operation: "upload",
          });
        }

        yield* Effect.logInfo(`File uploaded to ${connection.label}`).pipe(
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
                  Bucket: connection.bucket,
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

          yield* Effect.logInfo(`File deleted from ${connection.label}`).pipe(
            Effect.annotateLogs("key", key),
          );
        }),
      uploadThumbnail: (userId, file) =>
        uploadFile("thumbnails", userId, file, "jpg", THUMBNAIL_CONTENT_TYPE),
      uploadImage: (userId, file) => {
        const ext = file.name.split(".").pop() ?? "png";
        return uploadFile("images", userId, file, ext, imageContentType(ext));
      },
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
                  Bucket: connection.bucket,
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
                  Bucket: connection.bucket,
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

          yield* Effect.logInfo("Video upload URL presigned").pipe(
            Effect.annotateLogs({ key }),
          );

          return { contentType, key, url };
        }),
      finalizeVideoUpload: (pendingKey) =>
        Effect.gen(function* () {
          const finalKey = finalizedVideoKey(pendingKey);

          // SAFETY: CopySource is `${bucket}/${key}` with the key path
          // URL-encoded; the generated keys only ever contain UUIDs, a
          // whitelisted extension and `/` separators, so encoding each
          // segment is identity in practice and defensive by construction.
          const copySource = `${connection.bucket}/${pendingKey
            .split("/")
            .map(encodeURIComponent)
            .join("/")}`;

          yield* Effect.tryPromise({
            try: () =>
              client.send(
                new s3Mod.CopyObjectCommand({
                  Bucket: connection.bucket,
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

          // Best-effort cleanup of the staging copy: if this delete fails,
          // the bucket lifecycle rule expires it, so promotion must not
          // fail (a raised error here would leak the promoted object with
          // no uploadedKeys entry to roll back).
          yield* Effect.ignore(
            Effect.tryPromise({
              try: () =>
                client.send(
                  new s3Mod.DeleteObjectCommand({
                    Bucket: connection.bucket,
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
      listKeys: (prefix) =>
        Effect.gen(function* () {
          const keys: string[] = [];
          let continuationToken: string | undefined;
          // Paginated listing: the bucket can hold more objects than a
          // single response page returns (S3 caps at 1000 keys/page).
          for (;;) {
            const result = yield* Effect.tryPromise({
              try: () =>
                client.send(
                  new s3Mod.ListObjectsV2Command({
                    Bucket: connection.bucket,
                    ContinuationToken: continuationToken,
                    Prefix: prefix,
                  }),
                ),
              catch: (cause) =>
                new StorageError({
                  cause,
                  key: prefix,
                  message: `Failed to list objects: ${String(cause)}`,
                  operation: "head",
                }),
            });
            for (const object of result.Contents ?? []) {
              if (object.Key !== undefined) {
                keys.push(object.Key);
              }
            }
            if (
              !result.IsTruncated ||
              result.NextContinuationToken === undefined
            ) {
              break;
            }
            continuationToken = result.NextContinuationToken;
          }
          // SAFETY: only defined, non-empty string keys are pushed above,
          // so the array is exactly the ReadonlyArray<string> contract.
          return keys as ReadonlyArray<string>;
        }),
    } satisfies StorageModule["Service"];
  });

/** Layer form of {@link makeS3StorageService} for any S3-compatible store. */
export const makeS3StorageLayer = (
  connection: S3Connection,
): Layer.Layer<StorageModule, StorageError> =>
  Layer.effect(StorageModule, makeS3StorageService(connection));

/**
 * Production storage backed by Cloudflare R2. The app environment is loaded
 * lazily at layer construction so secrets are validated only when a server
 * runtime actually needs them.
 */
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

    return yield* makeS3StorageService({
      bucket: envServer.CLOUDFLARE_BUCKET,
      credentials: {
        accessKeyId: Redacted.value(envServer.CLOUDFLARE_ACCESS_KEY),
        secretAccessKey: Redacted.value(envServer.CLOUDFLARE_SECRET_KEY),
      },
      endpoint: envServer.CLOUDFLARE_R2,
      forcePathStyle: false,
      label: "R2",
      region: "auto",
    });
  }),
);

/** Local Docker RustFS store used by the service test layers. */
export const makeRustFSStorageLayer = (): Layer.Layer<
  StorageModule,
  StorageError
> =>
  makeS3StorageLayer({
    bucket: "e2e-test",
    credentials: {
      accessKeyId: "rustfsadmin",
      secretAccessKey: "rustfsadmin",
    },
    endpoint: "http://localhost:9000",
    forcePathStyle: true,
    label: "RustFS",
    region: "us-east-1",
  });
