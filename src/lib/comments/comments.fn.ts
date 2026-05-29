import { createServerFn } from "@tanstack/react-start";
import { Effect } from "effect";
import { z } from "zod";

import { commentInsertSchema } from "../db/schema";
import { createHandler } from "../server-fn.handler";
import { CommentsService, CommentsServiceLive } from "./comments.service";

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

export const fetchComments = createServerFn()
  .inputValidator((input: unknown) => z.number().parse(input))
  .handler(createHandler(fetchCommentsEffect, CommentsServiceLive));

export const addComment = createServerFn()
  .inputValidator((input: unknown) => commentInsertSchema.parse(input))
  .handler(createHandler(addCommentEffect, CommentsServiceLive));

export const deleteComment = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) =>
    z.object({ commentId: z.number() }).parse(input),
  )
  .handler(createHandler(deleteCommentEffect, CommentsServiceLive, "auth"));
