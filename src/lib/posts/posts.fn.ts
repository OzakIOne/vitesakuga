import { createServerFn } from "@tanstack/react-start";
import { Effect, Layer } from "effect";
import { z } from "zod";

import { PostsService, PostsServiceLive } from "./posts.service";
import {
  FormFileUploadSchema,
  postByTagSchema,
  searchPostsBaseSchema,
  updatePostInputSchema,
} from "./posts.schema";
import { Debug, withMinimumLogLevel } from "../effect/logger";

const LOG_LAYER = withMinimumLogLevel(Debug);

const importFactories = () => import("../db/layer-factories.server");

export const searchPostsEffect = Effect.fn("searchPosts")(function* (
  data: z.infer<typeof searchPostsBaseSchema>,
) {
  const svc = yield* PostsService;
  return yield* svc.search(data);
});

export const fetchPostDetailEffect = Effect.fn("fetchPostDetail")(function* (
  postId: number,
) {
  const svc = yield* PostsService;
  return yield* svc.fetchDetail(postId);
});

export const uploadPostEffect = Effect.fn("uploadPost")(function* (
  data: z.infer<typeof FormFileUploadSchema>,
) {
  const svc = yield* PostsService;
  return yield* svc.upload(data);
});

export const getPostsByTagEffect = Effect.fn("getPostsByTag")(function* (
  data: z.infer<typeof postByTagSchema>,
) {
  const svc = yield* PostsService;
  return yield* svc.getByTag(data);
});

export const updatePostEffect = Effect.fn("updatePost")(function* (
  data: z.infer<typeof updatePostInputSchema>,
) {
  const svc = yield* PostsService;
  return yield* svc.update(data);
});

// ---- createServerFn wrappers ----

export const searchPosts = createServerFn()
  .inputValidator((input: unknown) => searchPostsBaseSchema.parse(input))
  .handler(async ({ data }) => {
    const { makeDBLayer } = await importFactories();
    const dbLayer = await makeDBLayer();
    const layer = PostsServiceLive.pipe(Layer.provideMerge(dbLayer));
    return Effect.runPromise(
      searchPostsEffect(data).pipe(Effect.provide(layer)),
    );
  });

export const fetchPostDetail = createServerFn()
  .inputValidator((postId: unknown) => z.coerce.number().parse(postId))
  .handler(async ({ data }) => {
    const { makeDBLayer } = await importFactories();
    const dbLayer = await makeDBLayer();
    const layer = PostsServiceLive.pipe(Layer.provideMerge(dbLayer));
    return Effect.runPromise(
      fetchPostDetailEffect(data).pipe(Effect.provide(layer)),
    );
  });

export const uploadPost = createServerFn({ method: "POST" })
  .inputValidator((data: FormData) => {
    const raw = Object.fromEntries(data.entries());
    const normalized = {
      relatedPostId: undefined,
      source: undefined,
      ...raw,
      tags: raw.tags ? JSON.parse(raw.tags) : [],
      videoMetadata: raw.videoMetadata
        ? JSON.parse(raw.videoMetadata)
        : undefined,
    };
    return FormFileUploadSchema.parse(normalized);
  })
  .handler(async ({ data }) => {
    const { makeDBLayer } = await importFactories();
    const dbLayer = await makeDBLayer();
    const layer = Layer.mergeAll(
      PostsServiceLive.pipe(Layer.provideMerge(dbLayer)),
      LOG_LAYER,
    );
    return Effect.runPromise(
      uploadPostEffect(data).pipe(Effect.provide(layer)),
    );
  });

export const updatePost = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => updatePostInputSchema.parse(input))
  .handler(async ({ data }) => {
    const { makeAuthLayer } = await importFactories();
    const authLayer = await makeAuthLayer();
    const layer = PostsServiceLive.pipe(Layer.provideMerge(authLayer));
    return Effect.runPromise(
      updatePostEffect(data).pipe(Effect.provide(layer)),
    );
  });

export const getPostsByTag = createServerFn()
  .inputValidator((input: unknown) => postByTagSchema.parse(input))
  .handler(async ({ data }) => {
    const { makeDBLayer } = await importFactories();
    const dbLayer = await makeDBLayer();
    const layer = PostsServiceLive.pipe(Layer.provideMerge(dbLayer));
    return Effect.runPromise(
      getPostsByTagEffect(data).pipe(Effect.provide(layer)),
    );
  });
