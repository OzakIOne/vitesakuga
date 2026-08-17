import { Dialog, Portal } from "@ark-ui/react";
import { useSyncExternalStore } from "react";
import { LuX } from "react-icons/lu";

type Shortcut = {
  id: string;
  keys: string[];
  description: string;
};

type KeyboardShortcutsDialogProps = {
  onOpenChange: (details: { open: boolean }) => void;
  open: boolean;
};

const subscribe = (): (() => void) => () => {};

function isMacPlatform(): boolean {
  return (
    typeof navigator !== "undefined" &&
    (navigator.platform?.toLowerCase().includes("mac") ||
      navigator.userAgent.toLowerCase().includes("mac"))
  );
}

function getShortcuts(modKey: string): Shortcut[] {
  return [
    { description: "Navigate to Posts", id: "posts", keys: ["G", "P"] },
    { description: "Navigate to Users", id: "users", keys: ["G", "U"] },
    { description: "Focus search", id: "search-sequences", keys: ["G", "S"] },
    { description: "Focus search", id: "search-mod", keys: [modKey, "K"] },
    { description: "Show keyboard shortcuts", id: "help", keys: ["?"] },
    {
      description: "Seek previous frame (video)",
      id: "frame-back",
      keys: [","],
    },
    {
      description: "Seek next frame (video)",
      id: "frame-forward",
      keys: ["."],
    },
  ];
}

function KeyBadge({ children }: { children: React.ReactNode }) {
  return (
    <span className="rounded bg-gray-100 px-1.5 py-0.5 font-mono text-sm dark:bg-gray-800">
      {children}
    </span>
  );
}

export function KeyboardShortcutsDialog({
  onOpenChange,
  open,
}: KeyboardShortcutsDialogProps) {
  const isMac = useSyncExternalStore(subscribe, isMacPlatform, () => false);
  const shortcuts = getShortcuts(isMac ? "⌘" : "Ctrl");
  return (
    <Dialog.Root onOpenChange={onOpenChange} open={open}>
      <Portal>
        <Dialog.Backdrop className="fixed inset-0 z-50 bg-black/50" />
        <Dialog.Positioner className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <Dialog.Content className="w-full max-w-sm rounded-lg border border-gray-200 bg-white p-6 shadow-xl dark:border-gray-700 dark:bg-gray-900">
            <div className="flex items-center justify-between gap-4">
              <Dialog.Title className="text-lg font-semibold">
                Keyboard Shortcuts
              </Dialog.Title>
              <Dialog.CloseTrigger
                aria-label="Close keyboard shortcuts"
                className="rounded p-1 hover:bg-gray-100 dark:hover:bg-gray-800"
              >
                <LuX />
              </Dialog.CloseTrigger>
            </div>
            <table className="mt-4 w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200 text-left dark:border-gray-700">
                  <th className="pb-2 font-medium">Shortcut</th>
                  <th className="pb-2 text-right font-medium">Action</th>
                </tr>
              </thead>
              <tbody>
                {shortcuts.map((shortcut) => (
                  <tr
                    className="border-b border-gray-100 last:border-0 dark:border-gray-800"
                    key={shortcut.id}
                  >
                    <td className="py-2">
                      <span className="inline-flex items-center gap-1">
                        {shortcut.keys.map((key, i) => (
                          <span
                            className="inline-flex items-center gap-1"
                            key={key}
                          >
                            <KeyBadge>{key}</KeyBadge>
                            {i < shortcut.keys.length - 1 && (
                              <span className="mx-0.5 text-xs">then</span>
                            )}
                          </span>
                        ))}
                      </span>
                    </td>
                    <td className="py-2 text-right">{shortcut.description}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Dialog.Content>
        </Dialog.Positioner>
      </Portal>
    </Dialog.Root>
  );
}
