import { createServerFn } from "@tanstack/react-start";
import { Effect, Layer } from "effect";
import { z } from "zod";

import { commentInsertSchema } from "../db/schema";
import { CommentsService, CommentsServiceLive } from "./comments.service";

const importFactories = () => import("../db/layer-factories.server");

export const fetchCommentsEffect = Effect.fn("fetchComments")(function* (
  postId: number,
) {
  const svc = yield* CommentsService;
  return yield* svc.fetch(postId);
});

export const addCommentEffect = Effect.fn("addComment")(function* (
  data: z.infer<typeof commentInsertSchema>,
) {
  const svc = yield* CommentsService;
  return yield* svc.add(data);
});

export const deleteCommentEffect = Effect.fn("deleteComment")(function* (data: {
  commentId: number;
}) {
  const svc = yield* CommentsService;
  return yield* svc.delete_(data.commentId);
});

// ---- createServerFn wrappers ----

export const fetchComments = createServerFn()
  .inputValidator((input: unknown) => z.number().parse(input))
  .handler(async ({ data: postId }) => {
    const { makeDBLayer } = await importFactories();
    const dbLayer = await makeDBLayer();
    const layer = CommentsServiceLive.pipe(Layer.provideMerge(dbLayer));
    return Effect.runPromise(
      fetchCommentsEffect(postId).pipe(Effect.provide(layer)),
    );
  });

export const addComment = createServerFn()
  .inputValidator((input: unknown) => commentInsertSchema.parse(input))
  .handler(async ({ data }) => {
    const { makeDBLayer } = await importFactories();
    const dbLayer = await makeDBLayer();
    const layer = CommentsServiceLive.pipe(Layer.provideMerge(dbLayer));
    return Effect.runPromise(
      addCommentEffect(data).pipe(Effect.provide(layer)),
    );
  });

export const deleteComment = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) =>
    z.object({ commentId: z.number() }).parse(input),
  )
  .handler(async ({ data }) => {
    const { makeAuthLayer } = await importFactories();
    const authLayer = await makeAuthLayer();
    const layer = CommentsServiceLive.pipe(Layer.provideMerge(authLayer));
    return Effect.runPromise(
      deleteCommentEffect(data).pipe(Effect.provide(layer)),
    );
  });
