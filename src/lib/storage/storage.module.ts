import { Context, Effect, Schema } from "effect";

export class StorageError extends Schema.TaggedError<StorageError>()(
  "StorageError",
  {
    message: Schema.String,
    operation: Schema.Literals([
      "upload",
      "delete",
      "presign",
      "head",
      "finalize",
    ]),
    key: Schema.String,
    cause: Schema.Unknown,
  },
) {}

export type UploadedFileHead = {
  readonly contentLength: number;
  readonly contentType: string;
  /** The store's real ETag; never presented as a cryptographic digest. */
  readonly etag: string | null;
  /** SHA-256 metadata set by server-buffered image/thumbnail writes. */
  readonly metadataFingerprint: string | null;
};

export type StoredObject = {
  readonly etag: string | null;
  readonly fingerprint: string;
  readonly key: string;
};

export type DeterministicVideoUpload = {
  readonly contentType: string;
  readonly key: string;
  readonly requiredHeaders: Readonly<Record<string, string>>;
  readonly url: string;
};

export type DeterministicVideoCopy = {
  readonly etag: string | null;
  readonly key: string;
};

export type PresignedVideoUpload = {
  readonly contentType: string;
  readonly key: string;
  readonly url: string;
};

export class StorageModule extends Context.Service<
  StorageModule,
  {
    readonly uploadVideo: (
      userId: string,
      file: File,
    ) => Effect.Effect<{ key: string }, StorageError>;

    readonly uploadThumbnail: (
      userId: string,
      file: File,
    ) => Effect.Effect<{ key: string }, StorageError>;

    /**
     * Store a user-uploaded post image (jpg/png/webp) under the private
     * `images/{userId}/…` namespace; returns its storage key.
     */
    readonly uploadImage: (
      userId: string,
      file: File,
    ) => Effect.Effect<{ key: string }, StorageError>;

    /** Store bytes at a lifecycle-reserved image key, hashing before PUT. */
    readonly putImage: (
      key: string,
      file: File,
    ) => Effect.Effect<StoredObject, StorageError>;

    /** Store bytes at a lifecycle-reserved thumbnail key, hashing before PUT. */
    readonly putThumbnail: (
      key: string,
      file: File,
    ) => Effect.Effect<StoredObject, StorageError>;

    readonly deleteFile: (key: string) => Effect.Effect<void, StorageError>;

    readonly headFile: (
      key: string,
    ) => Effect.Effect<UploadedFileHead, StorageError>;

    readonly presignVideoUpload: (
      userId: string,
      ext: string,
    ) => Effect.Effect<PresignedVideoUpload, StorageError>;

    /** Presign only a deterministic staging key; final keys are never signed. */
    readonly presignDeterministicVideoUpload: (
      userId: string,
      key: string,
      contentType: string,
    ) => Effect.Effect<DeterministicVideoUpload, StorageError>;

    /** Copy a staged video only if its source ETag and final key are unchanged. */
    readonly copyVideoIfMatch: (
      sourceKey: string,
      sourceEtag: string,
      finalKey: string,
    ) => Effect.Effect<DeterministicVideoCopy, StorageError>;

    /**
     * Promote a pending direct-to-R2 upload out of the staging namespace:
     * copies the object to its final `videos/{userId}/…` key and best-effort
     * deletes the pending one (any leftover expires via the bucket lifecycle
     * rule). Returns the final key to persist in the DB.
     */
    readonly finalizeVideoUpload: (
      pendingKey: string,
    ) => Effect.Effect<{ key: string }, StorageError>;

    /**
     * Lists every live object key under a prefix (all pages). Read-only
     * support for admin storage audits; never exposed to regular users.
     */
    readonly listKeys: (
      prefix: string,
    ) => Effect.Effect<ReadonlyArray<string>, StorageError>;
  }
>()("StorageModule") {}
