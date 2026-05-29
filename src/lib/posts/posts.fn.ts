import { createServerFn } from "@tanstack/react-start";
import { Effect } from "effect";
import { z } from "zod";

import { createHandler } from "../server-fn.handler";
import {
  FormFileUploadSchema,
  postByTagSchema,
  searchPostsBaseSchema,
  updatePostInputSchema,
} from "./posts.schema";
import { PostsService, PostsServiceLive } from "./posts.service";

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

export const searchPosts = createServerFn()
  .inputValidator((input: unknown) => searchPostsBaseSchema.parse(input))
  .handler(createHandler(searchPostsEffect, PostsServiceLive));

export const fetchPostDetail = createServerFn()
  .inputValidator((postId: unknown) => z.coerce.number().parse(postId))
  .handler(createHandler(fetchPostDetailEffect, PostsServiceLive));

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
  .handler(createHandler(uploadPostEffect, PostsServiceLive));

export const updatePost = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => updatePostInputSchema.parse(input))
  .handler(createHandler(updatePostEffect, PostsServiceLive, "auth"));

export const getPostsByTag = createServerFn()
  .inputValidator((input: unknown) => postByTagSchema.parse(input))
  .handler(createHandler(getPostsByTagEffect, PostsServiceLive));
