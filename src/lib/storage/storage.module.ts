import { Context, Data, Effect } from "effect";

export class StorageError extends Data.TaggedError("StorageError")<{
  readonly message: string;
  readonly operation: "upload" | "delete";
  readonly key: string;
  readonly cause: unknown;
}> {}

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
