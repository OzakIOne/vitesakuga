import { Portal } from "@ark-ui/react";
import { Button, CloseButton } from "src/components/ui/button";
import { Dialog } from "src/components/ui/overlay";

type ConfirmationDialogProps = {
  confirmLabel: string;
  confirming: boolean;
  description: string;
  onConfirm: () => void;
  onOpenChange: (open: boolean) => void;
  open: boolean;
  title: string;
};

export function ConfirmationDialog({
  confirmLabel,
  confirming,
  description,
  onConfirm,
  onOpenChange,
  open,
  title,
}: ConfirmationDialogProps) {
  return (
    <Dialog.Root
      onOpenChange={(details) => onOpenChange(details.open)}
      open={open}
      role="alertdialog"
    >
      <Portal>
        <Dialog.Backdrop />
        <Dialog.Positioner>
          <Dialog.Content maxW="md">
            <Dialog.Header>
              <Dialog.Title>{title}</Dialog.Title>
              <Dialog.CloseTrigger asChild>
                <CloseButton size="sm" />
              </Dialog.CloseTrigger>
            </Dialog.Header>
            <Dialog.Body>
              <Dialog.Description>{description}</Dialog.Description>
            </Dialog.Body>
            <Dialog.Footer>
              <Dialog.ActionTrigger asChild>
                <Button variant="outline">Cancel</Button>
              </Dialog.ActionTrigger>
              <Button
                colorPalette="red"
                loading={confirming}
                onClick={onConfirm}
              >
                {confirmLabel}
              </Button>
            </Dialog.Footer>
          </Dialog.Content>
        </Dialog.Positioner>
      </Portal>
    </Dialog.Root>
  );
}
