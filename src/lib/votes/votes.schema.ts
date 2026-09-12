import { Schema } from "effect";

import { postVoteSchema } from "../db/schema";
import { PostId } from "../ids";
import { PageNumberSchema } from "../pagination/pagination.schema";

export const setPostVoteSchema = Schema.Struct({
  postId: PostId.pipe(Schema.check(Schema.isGreaterThanOrEqualTo(0))),
  vote: postVoteSchema,
});

export const removePostVoteSchema = Schema.Struct({
  postId: PostId.pipe(Schema.check(Schema.isGreaterThanOrEqualTo(0))),
});

export const fetchLikedPostsSchema = Schema.Struct({
  page: PageNumberSchema,
});

export type SetPostVoteInput = Schema.Schema.Type<typeof setPostVoteSchema>;
export type RemovePostVoteInput = Schema.Schema.Type<
  typeof removePostVoteSchema
>;
export type FetchLikedPostsInput = Schema.Schema.Type<
  typeof fetchLikedPostsSchema
>;
