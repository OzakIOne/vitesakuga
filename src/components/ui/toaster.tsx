"use client";

import {
  Portal,
  Toast,
  Toaster as ArkToaster,
  createToaster,
} from "@ark-ui/react";
import { LuCircleAlert, LuCircleCheck, LuLoader, LuX } from "react-icons/lu";

export const toaster = createToaster({
  pauseOnPageIdle: true,
  placement: "bottom-end",
  overlap: true,
  gap: 24,
});

function ToastIndicator({ type }: { type: string | undefined }) {
  if (type === "success") {
    return (
      <LuCircleCheck
        aria-hidden="true"
        className="text-success-600 mt-0.5 h-4 w-4 shrink-0"
      />
    );
  }
  if (type === "error") {
    return (
      <LuCircleAlert
        aria-hidden="true"
        className="text-danger-600 mt-0.5 h-4 w-4 shrink-0"
      />
    );
  }
  return (
    <LuLoader
      aria-hidden="true"
      className="text-accent-600 dark:text-accent-400 mt-0.5 h-4 w-4 shrink-0 animate-spin"
    />
  );
}

export const Toaster = () => (
  <Portal>
    <ArkToaster toaster={toaster}>
      {(toast) => (
        <Toast.Root
          className={
            "border-tone-200 dark:border-tone-700 dark:bg-tone-800 pointer-events-auto flex w-full items-start gap-3 rounded-lg border bg-white p-4 shadow-lg " +
            (toast.type === "success"
              ? "border-success-200 dark:border-success-800"
              : toast.type === "error"
                ? "border-danger-200 dark:border-danger-800"
                : "border-tone-200 dark:border-tone-700")
          }
        >
          <ToastIndicator type={toast.type} />
          <div className="flex min-w-0 flex-1 flex-col gap-1">
            {toast.title && (
              <Toast.Title className="text-tone-900 dark:text-tone-100 text-sm font-semibold">
                {toast.title}
              </Toast.Title>
            )}
            {toast.description && (
              <Toast.Description className="text-tone-600 dark:text-tone-300 text-sm">
                {toast.description}
              </Toast.Description>
            )}
          </div>
          {toast.action && (
            <Toast.ActionTrigger className="text-accent-600 dark:text-accent-400 shrink-0 text-sm font-medium hover:underline">
              {toast.action.label}
            </Toast.ActionTrigger>
          )}
          {toast.closable && (
            <Toast.CloseTrigger
              aria-label="Dismiss notification"
              className="text-tone-500 hover:bg-tone-100 hover:text-tone-700 dark:text-tone-400 dark:hover:bg-tone-700 dark:hover:text-tone-200 shrink-0 rounded p-1 transition-colors"
            >
              <LuX aria-hidden="true" />
            </Toast.CloseTrigger>
          )}
        </Toast.Root>
      )}
    </ArkToaster>
  </Portal>
);
