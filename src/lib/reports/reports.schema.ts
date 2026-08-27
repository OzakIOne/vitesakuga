import { Schema } from "effect";

import { postReportReasonSchema } from "../db/schema";
import { PostId } from "../ids";

export const submitPostReportSchema = Schema.Struct({
  postId: PostId.pipe(Schema.check(Schema.isGreaterThanOrEqualTo(0))),
  reason: postReportReasonSchema,
});

export type SubmitPostReportInput = Schema.Schema.Type<
  typeof submitPostReportSchema
>;
