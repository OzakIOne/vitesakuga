import { useMutation, type UseMutationOptions } from "@tanstack/react-query";
import { toaster } from "src/components/ui/toaster";

// The path to the public login route (`src/routes/(auth)/login.tsx`).
const LOGIN_PATH = "/login";

/**
 * Read the discriminant tag off an error that crossed the server-function
 * boundary. Tagged errors are serialized with their own properties intact,
 * so `_tag` survives the round trip even though the class identity does not.
 */
// oxlint-disable anti-slop/no-runtime-typeof -- errorTag is itself the
// deserialization boundary for server-function errors; the wire payload is
// untyped, so verifying `_tag`'s runtime type IS the domain check.
export function errorTag(cause: unknown): string | undefined {
  if (typeof cause !== "object" || cause === null) return undefined;
  // SAFETY: the guard above establishes `cause` is a non-null object, so
  // reading its optional `_tag` property cannot throw; the value's type is
  // verified by the string check before it is returned.
  const tag = (cause as { _tag?: unknown })._tag;
  return typeof tag === "string" ? tag : undefined;
}
// oxlint-enable anti-slop/no-runtime-typeof

const actionForTag = (
  tag: string | undefined,
  retry: (() => void) | undefined,
): { label: string; onClick: () => void } | undefined => {
  if (retry) {
    return { label: "Retry", onClick: retry };
  }
  // An UnauthorizedError means the session is missing or expired mid-use;
  // offer a direct path back into the app instead of a dead-end message.
  if (tag === "UnauthorizedError") {
    return {
      label: "Log in",
      onClick: () => {
        window.location.assign(LOGIN_PATH);
      },
    };
  }
  return undefined;
};

export function errorMessage(cause: unknown, fallback: string): string {
  return cause instanceof Error && cause.message ? cause.message : fallback;
}

export function toastSuccess(title: string, description?: string): void {
  toaster.create({
    closable: true,
    description,
    duration: 3000,
    title,
    type: "success",
  });
}

export function toastError(
  title: string,
  cause: unknown,
  fallback: string,
  retry?: () => void,
): void {
  toaster.create({
    action: actionForTag(errorTag(cause), retry),
    closable: true,
    description: errorMessage(cause, fallback),
    duration: 5000,
    title,
    type: "error",
  });
}

type MutationFeedbackOptions = {
  readonly errorFallback: string;
  readonly errorTitle: string;
  readonly successDescription?: string;
  readonly successTitle: string;
};

export function useMutationWithFeedback<
  TData,
  TVariables = void,
  TContext = unknown,
>(
  options: UseMutationOptions<TData, Error, TVariables, TContext> &
    MutationFeedbackOptions,
) {
  const {
    errorFallback,
    errorTitle,
    successDescription,
    successTitle,
    onError,
    onSuccess,
    ...mutationOptions
  } = options;

  return useMutation({
    ...mutationOptions,
    onError: (error, variables, context, meta) => {
      toastError(errorTitle, error, errorFallback);
      onError?.(error, variables, context, meta);
    },
    onSuccess: (data, variables, context, meta) => {
      onSuccess?.(data, variables, context, meta);
      toastSuccess(successTitle, successDescription);
    },
  });
}
