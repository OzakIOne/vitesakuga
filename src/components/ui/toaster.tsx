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
});

function ToastIndicator({ type }: { type: string | undefined }) {
  if (type === "success") {
    return <LuCircleCheck className="mt-0.5 h-4 w-4 shrink-0 text-green-600" />;
  }
  if (type === "error") {
    return <LuCircleAlert className="mt-0.5 h-4 w-4 shrink-0 text-red-600" />;
  }
  return (
    <LuLoader className="mt-0.5 h-4 w-4 shrink-0 animate-spin text-blue-600" />
  );
}

export const Toaster = () => (
  <Portal>
    <ArkToaster toaster={toaster}>
      {(toast) => (
        <Toast.Root
          className={
            "pointer-events-auto flex w-full items-start gap-3 rounded-lg border bg-white p-4 shadow-lg dark:bg-gray-800 " +
            (toast.type === "success"
              ? "border-green-200 dark:border-green-800"
              : toast.type === "error"
                ? "border-red-200 dark:border-red-800"
                : "border-gray-200 dark:border-gray-700")
          }
        >
          <ToastIndicator type={toast.type} />
          <div className="flex min-w-0 flex-1 flex-col gap-1">
            {toast.title && (
              <Toast.Title className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                {toast.title}
              </Toast.Title>
            )}
            {toast.description && (
              <Toast.Description className="text-sm text-gray-600 dark:text-gray-300">
                {toast.description}
              </Toast.Description>
            )}
          </div>
          {toast.action && (
            <Toast.ActionTrigger className="shrink-0 text-sm font-medium text-blue-600 hover:underline">
              {toast.action.label}
            </Toast.ActionTrigger>
          )}
          {toast.closable && (
            <Toast.CloseTrigger className="shrink-0 rounded p-1 text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-700">
              <LuX />
            </Toast.CloseTrigger>
          )}
        </Toast.Root>
      )}
    </ArkToaster>
  </Portal>
);
