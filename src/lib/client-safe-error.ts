import { Schema } from "effect";

/**
 * Pass as the annotations argument of `Schema.TaggedError` to declare that the
 * error's message was written for the user and may cross the server-function
 * boundary unchanged.
 */
export const clientSafeAnnotations = {
  clientSafe: true,
} satisfies Schema.Annotations.Annotations;

export const isClientSafeError = (error: Error): boolean => {
  const errorClass: unknown = error.constructor;
  if (!Schema.isSchema(errorClass)) {
    return false;
  }
  return Schema.resolveAnnotations(errorClass)?.["clientSafe"] === true;
};
