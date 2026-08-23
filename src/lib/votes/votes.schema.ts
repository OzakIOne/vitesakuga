import { Schema } from "effect";

import { postVoteSchema } from "../db/schema";
import { PostId } from "../ids";

export const setPostVoteSchema = Schema.Struct({
  postId: PostId.pipe(Schema.check(Schema.isGreaterThanOrEqualTo(0))),
  vote: postVoteSchema,
});

export const removePostVoteSchema = Schema.Struct({
  postId: PostId.pipe(Schema.check(Schema.isGreaterThanOrEqualTo(0))),
});

export const fetchLikedPostsSchema = Schema.Struct({
  page: Schema.Number.pipe(Schema.check(Schema.isGreaterThanOrEqualTo(0))),
});

export type SetPostVoteInput = Schema.Schema.Type<typeof setPostVoteSchema>;
export type RemovePostVoteInput = Schema.Schema.Type<
  typeof removePostVoteSchema
>;
export type FetchLikedPostsInput = Schema.Schema.Type<
  typeof fetchLikedPostsSchema
>;
