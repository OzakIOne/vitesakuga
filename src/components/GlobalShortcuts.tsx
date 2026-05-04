import { Box, IconButton } from "@chakra-ui/react";
import { useHotkey, useHotkeySequences } from "@tanstack/react-hotkeys";
import { useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { KeyboardShortcutsDialog } from "src/components/KeyboardShortcutsDialog";

export function GlobalShortcuts() {
  const navigate = useNavigate();
  const [shortcutsOpen, setShortcutsOpen] = useState(false);

  useHotkey({ key: "/", shift: true }, () => {
    setShortcutsOpen((open) => !open);
  });

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
      callback: () => {
        const searchInput = document.getElementById("search-input");
        searchInput?.focus();
      },
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
