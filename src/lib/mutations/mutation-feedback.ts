import { useMutation, type UseMutationOptions } from "@tanstack/react-query";
import { toaster } from "src/components/ui/toaster";

export function errorMessage(
  error: Error | string | null | undefined,
  fallback: string,
): string {
  return error instanceof Error && error.message ? error.message : fallback;
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
  error: Error,
  fallback: string,
  retry?: () => void,
): void {
  toaster.create({
    action: retry ? { label: "Retry", onClick: retry } : undefined,
    closable: true,
    description: errorMessage(error, fallback),
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
