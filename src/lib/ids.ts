import { Schema } from "effect";

export const PostId = Schema.Number.pipe(Schema.brand("PostId"));
export type PostId = number & { readonly PostId: unique symbol };

export const UserId = Schema.String.pipe(Schema.brand("UserId"));
export type UserId = string & { readonly UserId: unique symbol };

export const TagId = Schema.Number.pipe(Schema.brand("TagId"));
export type TagId = number & { readonly TagId: unique symbol };

export const CommentId = Schema.Number.pipe(Schema.brand("CommentId"));
export type CommentId = number & { readonly CommentId: unique symbol };
