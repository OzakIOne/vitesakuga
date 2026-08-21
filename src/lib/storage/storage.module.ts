import { Context, Effect, Schema } from "effect";

export class StorageError extends Schema.TaggedError<StorageError>()(
  "StorageError",
  {
    message: Schema.String,
    operation: Schema.Literals(["upload", "delete", "presign", "head"]),
    key: Schema.String,
    cause: Schema.Unknown,
  },
) {}

export type UploadedFileHead = {
  readonly contentLength: number;
  readonly contentType: string;
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

    readonly deleteFile: (key: string) => Effect.Effect<void, StorageError>;

    readonly headFile: (
      key: string,
    ) => Effect.Effect<UploadedFileHead, StorageError>;

    readonly presignVideoUpload: (
      userId: string,
      ext: string,
    ) => Effect.Effect<PresignedVideoUpload, StorageError>;
  }
>()("StorageModule") {}
