// @vitest-environment happy-dom
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  errorMessage,
  toastError,
  toastSuccess,
  useMutationWithFeedback,
} from "./mutation-feedback";

vi.mock("src/components/ui/toaster", () => ({
  toaster: {
    create: vi.fn(),
  },
}));

beforeEach(async () => {
  const { toaster } = await import("src/components/ui/toaster");
  vi.mocked(toaster.create).mockClear();
});

const createWrapper = () => {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
};

describe(errorMessage, () => {
  it("returns the error message when available", () => {
    expect(errorMessage(new Error("boom"), "fallback")).toBe("boom");
  });

  it("returns the fallback for non-errors", () => {
    expect(errorMessage("boom", "fallback")).toBe("fallback");
    expect(errorMessage(undefined, "fallback")).toBe("fallback");
  });

  it("returns the fallback for errors without a message", () => {
    expect(errorMessage(new Error(""), "fallback")).toBe("fallback");
  });
});

describe(toastError, () => {
  it("creates an error toast with the resolved message", async () => {
    toastError("Title", new Error("nope"), "fallback");

    const { toaster } = await import("src/components/ui/toaster");
    expect(toaster.create).toHaveBeenCalledWith(
      expect.objectContaining({
        description: "nope",
        title: "Title",
        type: "error",
      }),
    );
  });

  it("adds a retry action when provided", async () => {
    const retry = vi.fn();
    toastError("Title", new Error("nope"), "fallback", retry);

    const { toaster } = await import("src/components/ui/toaster");
    expect(toaster.create).toHaveBeenCalledWith(
      expect.objectContaining({
        action: { label: "Retry", onClick: retry },
      }),
    );
  });
});

describe(toastSuccess, () => {
  it("creates a success toast", async () => {
    toastSuccess("Done", "All good");

    const { toaster } = await import("src/components/ui/toaster");
    expect(toaster.create).toHaveBeenCalledWith(
      expect.objectContaining({
        description: "All good",
        title: "Done",
        type: "success",
      }),
    );
  });
});

describe(useMutationWithFeedback, () => {
  it("runs onSuccess and shows the success toast", async () => {
    const onSuccess = vi.fn();
    const { result } = renderHook(
      () =>
        useMutationWithFeedback({
          errorFallback: "nope",
          errorTitle: "Error",
          mutationFn: async (value: number) => value * 2,
          onSuccess,
          successTitle: "Done",
        }),
      { wrapper: createWrapper() },
    );

    result.current.mutate(21);
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    const { toaster } = await import("src/components/ui/toaster");
    expect(onSuccess.mock.calls[0]?.slice(0, 3)).toEqual([42, 21, undefined]);
    expect(toaster.create).toHaveBeenCalledWith(
      expect.objectContaining({ title: "Done", type: "success" }),
    );
  });

  it("runs onError and shows the error toast", async () => {
    const onError = vi.fn();
    const { result } = renderHook(
      () =>
        useMutationWithFeedback({
          errorFallback: "fallback",
          errorTitle: "Error",
          mutationFn: async (_: void) => {
            throw new Error("boom");
          },
          onError,
          successTitle: "Done",
        }),
      { wrapper: createWrapper() },
    );

    result.current.mutate();
    await waitFor(() => expect(result.current.isError).toBe(true));

    const { toaster } = await import("src/components/ui/toaster");
    expect(onError).toHaveBeenCalled();
    expect(toaster.create).toHaveBeenCalledWith(
      expect.objectContaining({
        description: "boom",
        title: "Error",
        type: "error",
      }),
    );
  });
});
