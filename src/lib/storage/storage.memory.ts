import { Effect, Layer } from "effect";

import { StorageModule } from "./storage.module";

// to delete i think we are not working with in memory S3 like anymore we moved to rustfs
const store = new Map<string, Uint8Array>();

export const StorageMemoryLive = Layer.succeed(StorageModule)({
  deleteFile: (key) =>
    Effect.sync(() => {
      store.delete(key);
    }),
  uploadThumbnail: (userId, file) =>
    Effect.gen(function* () {
      const key = `thumbnails/${userId}/${crypto.randomUUID()}.jpg`;
      const arrayBuffer = yield* Effect.promise(() => file.arrayBuffer());
      store.set(key, new Uint8Array(arrayBuffer));
      return { key };
    }),
  uploadVideo: (userId, file) =>
    Effect.gen(function* () {
      const ext = file.name.split(".").pop() ?? "mp4";
      const key = `videos/${userId}/${crypto.randomUUID()}.${ext}`;
      const arrayBuffer = yield* Effect.promise(() => file.arrayBuffer());
      store.set(key, new Uint8Array(arrayBuffer));
      return { key };
    }),
});
