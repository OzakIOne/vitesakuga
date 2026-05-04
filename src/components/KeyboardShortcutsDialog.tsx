import {
  Badge,
  Box,
  Dialog,
  Flex,
  Portal,
  Stack,
  Table,
} from "@chakra-ui/react";
import { LuX } from "react-icons/lu";

type Shortcut = {
  keys: string[];
  description: string;
};

const SHORTCUTS: Shortcut[] = [
  { description: "Navigate to Posts", keys: ["G", "P"] },
  { description: "Navigate to Users", keys: ["G", "U"] },
  { description: "Focus search", keys: ["G", "S"] },
  { description: "Show keyboard shortcuts", keys: ["?"] },
  { description: "Seek previous frame (video)", keys: [","] },
  { description: "Seek next frame (video)", keys: ["."] },
];

type KeyboardShortcutsDialogProps = {
  onOpenChange: (details: { open: boolean }) => void;
  open: boolean;
};

function KeyBadge({ children }: { children: React.ReactNode }) {
  return (
    <Badge fontFamily="mono" fontSize="sm" px={1.5} py={0.5} variant="subtle">
      {children}
    </Badge>
  );
}

export function KeyboardShortcutsDialog({
  onOpenChange,
  open,
}: KeyboardShortcutsDialogProps) {
  return (
    <Dialog.Root
      onOpenChange={onOpenChange}
      open={open}
      placement="center"
      size="sm"
    >
      <Portal>
        <Dialog.Backdrop />
        <Dialog.Positioner>
          <Dialog.Content>
            <Dialog.Header>
              <Dialog.Title>Keyboard Shortcuts</Dialog.Title>
              <Dialog.CloseTrigger>
                <LuX />
              </Dialog.CloseTrigger>
            </Dialog.Header>
            <Dialog.Body>
              <Stack gap={3}>
                <Table.Root size="sm" variant="line">
                  <Table.Header>
                    <Table.Row>
                      <Table.ColumnHeader>Shortcut</Table.ColumnHeader>
                      <Table.ColumnHeader textAlign="end">
                        Action
                      </Table.ColumnHeader>
                    </Table.Row>
                  </Table.Header>
                  <Table.Body>
                    {SHORTCUTS.map((shortcut) => (
                      <Table.Row key={shortcut.description}>
                        <Table.Cell>
                          <Flex align="center" gap={1}>
                            {shortcut.keys.map((key, i) => (
                              <Box
                                alignItems="center"
                                display="flex"
                                gap={1}
                                key={key}
                              >
                                <KeyBadge>{key}</KeyBadge>
                                {i < shortcut.keys.length - 1 && (
                                  <Box as="span" fontSize="xs" mx={0.5}>
                                    then
                                  </Box>
                                )}
                              </Box>
                            ))}
                          </Flex>
                        </Table.Cell>
                        <Table.Cell textAlign="end">
                          {shortcut.description}
                        </Table.Cell>
                      </Table.Row>
                    ))}
                  </Table.Body>
                </Table.Root>
              </Stack>
            </Dialog.Body>
          </Dialog.Content>
        </Dialog.Positioner>
      </Portal>
    </Dialog.Root>
  );
}
