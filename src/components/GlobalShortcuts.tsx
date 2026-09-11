import { useHotkey, useHotkeySequences } from "@tanstack/react-hotkeys";
import { useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { KeyboardShortcutsDialog } from "src/components/KeyboardShortcutsDialog";
import { IconButton } from "src/components/ui/button";
import { Box } from "src/components/ui/layout";

function focusSearchInput(): boolean {
  const searchInput = document.getElementById("search-input");
  searchInput?.focus();
  return searchInput !== null;
}

export function GlobalShortcuts() {
  const navigate = useNavigate();
  const [shortcutsOpen, setShortcutsOpen] = useState(false);
  const focusOrOpenSearch = () => {
    if (focusSearchInput()) return;
    void navigate({ to: "/posts" }).then(() => {
      requestAnimationFrame(focusSearchInput);
    });
  };

  useHotkey({ key: "/", shift: true }, () => {
    setShortcutsOpen((open) => !open);
  });

  useHotkey("Mod+K", focusOrOpenSearch);

  useHotkeySequences([
    {
      callback: () => {
        void navigate({ to: "/posts" });
      },
      sequence: ["G", "P"],
    },
    {
      callback: () => {
        void navigate({ to: "/users" });
      },
      sequence: ["G", "U"],
    },
    {
      callback: focusOrOpenSearch,
      sequence: ["G", "S"],
    },
  ]);

  return (
    <>
      <Box bottom={4} left={4} position="fixed" zIndex={50}>
        <IconButton
          aria-label="Keyboard shortcuts"
          onClick={() => {
            setShortcutsOpen(true);
          }}
          rounded="full"
          size="xs"
          variant="outline"
        >
          ?
        </IconButton>
      </Box>
      <KeyboardShortcutsDialog
        onOpenChange={({ open }) => {
          setShortcutsOpen(open);
        }}
        open={shortcutsOpen}
      />
    </>
  );
}
