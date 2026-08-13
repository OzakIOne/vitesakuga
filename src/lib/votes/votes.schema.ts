import { Schema } from "effect";

import { postVoteSchema } from "../db/schema";

export const setPostVoteSchema = Schema.Struct({
  postId: Schema.Number.pipe(Schema.check(Schema.isGreaterThanOrEqualTo(0))),
  vote: postVoteSchema,
});

export const removePostVoteSchema = Schema.Struct({
  postId: Schema.Number.pipe(Schema.check(Schema.isGreaterThanOrEqualTo(0))),
});

export type SetPostVoteInput = Schema.Schema.Type<typeof setPostVoteSchema>;
export type RemovePostVoteInput = Schema.Schema.Type<
  typeof removePostVoteSchema
>;
