import { Schema } from "effect";

import { MAX_TAG_NAME_LENGTH } from "../search/search-limits";

const tagNameSchema = Schema.String.pipe(
  Schema.check(
    Schema.isMaxLength(MAX_TAG_NAME_LENGTH, {
      message: `Tag names must not exceed ${MAX_TAG_NAME_LENGTH} characters`,
    }),
  ),
);

export const tagFollowStateSchema = Schema.Struct({
  tagName: tagNameSchema,
});

export const setTagFollowedSchema = Schema.Struct({
  followed: Schema.Boolean,
  tagName: tagNameSchema,
});
