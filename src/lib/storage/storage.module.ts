import { Context, Effect, Schema } from "effect";

export class StorageError extends Schema.TaggedError<StorageError>()(
  "StorageError",
  {
    message: Schema.String,
    operation: Schema.Literals(["upload", "delete"]),
    key: Schema.String,
    cause: Schema.Unknown,
  },
) {}

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
  }
>()("StorageModule") {}
