import { Portal } from "@ark-ui/react";
import { getAuthenticatorName, type Passkey } from "@better-auth/passkey";
import { useState } from "react";
import { LuFingerprint, LuPencil, LuTrash2 } from "react-icons/lu";
import { EmptyState } from "src/components/EmptyState";
import { Button, CloseButton } from "src/components/ui/button";
import { Alert } from "src/components/ui/feedback";
import { Field, Input } from "src/components/ui/field";
import { Dialog } from "src/components/ui/overlay";
import { Heading, Text } from "src/components/ui/typography";
import {
  useAddPasskey,
  useDeletePasskey,
  usePasskeys,
  useRenamePasskey,
} from "src/lib/auth/auth.hooks";
import { formatDateUtc } from "src/utils/date-format";

function passkeyLabel(passkey: Passkey): string {
  return passkey.name || getAuthenticatorName(passkey.aaguid) || "Passkey";
}

const passkeyTransportLabel = (transport: string): string => {
  switch (transport) {
    case "ble":
      return "Bluetooth";
    case "hybrid":
      return "Nearby device";
    case "internal":
      return "This device";
    case "nfc":
      return "NFC";
    case "smart-card":
      return "Smart card";
    case "usb":
      return "USB";
    default:
      return transport;
  }
};

const passkeyTransportsLabel = (transports: string | undefined): string =>
  transports
    ? transports
        .split(",")
        .map((transport) => transport.trim())
        .filter(Boolean)
        .map(passkeyTransportLabel)
        .join(", ")
    : "";

/**
 * Passkey management for the account page: list, add, rename and delete the
 * WebAuthn credentials attached to the signed-in user.
 */
export function PasskeysSection() {
  const addPasskey = useAddPasskey();
  const deletePasskey = useDeletePasskey();
  const renamePasskey = useRenamePasskey();
  const passkeysQuery = usePasskeys();
  const passkeys = passkeysQuery.data ?? [];
  const [renameTarget, setRenameTarget] = useState<Passkey | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Passkey | null>(null);
  const [newName, setNewName] = useState("");

  const openRename = (passkey: Passkey) => {
    setRenameTarget(passkey);
    setNewName(passkey.name || "");
  };

  const handleRename = (e: React.SubmitEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!renameTarget || !newName.trim()) {
      return;
    }
    renamePasskey.mutate(
      { id: renameTarget.id, name: newName.trim() },
      {
        onSuccess: () => setRenameTarget(null),
      },
    );
  };

  return (
    <section className="border-t border-gray-200 pt-12 dark:border-gray-700">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <Heading as="h2" size="md">
            Passkeys
          </Heading>
          <Text color="gray.500" fontSize="sm" mt={1}>
            Sign in securely with your device&apos;s biometrics, PIN or security
            key.
          </Text>
        </div>
        <Button
          colorPalette="blue"
          disabled={addPasskey.isPending}
          onClick={() => addPasskey.mutate({})}
          size="sm"
        >
          <LuFingerprint />
          {addPasskey.isPending ? "Registering…" : "Add passkey"}
        </Button>
      </div>

      <div className="mt-5 space-y-3">
        {passkeysQuery.isLoading ? (
          <Text color="gray.500" fontSize="sm">
            Loading passkeys…
          </Text>
        ) : passkeysQuery.isError ? (
          <Alert.Root status="error">
            <Alert.Content>
              <Alert.Indicator status="error" />
              <div>
                <Alert.Title>Could not load passkeys</Alert.Title>
                <Alert.Description>
                  Your saved sign-in methods could not be loaded.
                </Alert.Description>
                <Button
                  className="mt-3"
                  onClick={() => passkeysQuery.refetch()}
                  size="sm"
                  variant="outline"
                >
                  Retry
                </Button>
              </div>
            </Alert.Content>
          </Alert.Root>
        ) : passkeys.length === 0 ? (
          <EmptyState
            description="Add one to skip passwords on your next sign-in."
            size="compact"
            title="No passkeys yet"
            titleAs="h3"
          />
        ) : (
          passkeys.map((passkey) => (
            <div
              className="flex items-center justify-between gap-4 rounded-lg border border-gray-200 p-4 dark:border-gray-700"
              key={passkey.id}
            >
              <div className="flex min-w-0 items-center gap-3">
                <LuFingerprint
                  aria-hidden="true"
                  className="shrink-0 text-gray-400"
                  size={20}
                />
                <div className="min-w-0">
                  <Text
                    className="max-w-56 truncate"
                    fontSize="sm"
                    fontWeight="medium"
                  >
                    {passkeyLabel(passkey)}
                  </Text>
                  <Text color="gray.500" fontSize="xs">
                    Added {formatDateUtc(passkey.createdAt)}
                    {passkeyTransportsLabel(passkey.transports)
                      ? ` · ${passkeyTransportsLabel(passkey.transports)}`
                      : ""}
                  </Text>
                </div>
              </div>
              <div className="flex shrink-0 gap-2">
                <Button
                  aria-label={`Rename ${passkeyLabel(passkey)}`}
                  onClick={() => openRename(passkey)}
                  size="sm"
                  variant="outline"
                >
                  <LuPencil />
                </Button>
                <Button
                  aria-label={`Delete ${passkeyLabel(passkey)}`}
                  colorPalette="red"
                  disabled={deletePasskey.isPending}
                  onClick={() => setDeleteTarget(passkey)}
                  size="sm"
                  variant="outline"
                >
                  <LuTrash2 />
                </Button>
              </div>
            </div>
          ))
        )}
      </div>

      <Dialog.Root
        onOpenChange={(details) => {
          if (!details.open) {
            setDeleteTarget(null);
          }
        }}
        open={deleteTarget !== null}
        role="alertdialog"
      >
        <Portal>
          <Dialog.Backdrop />
          <Dialog.Positioner>
            <Dialog.Content>
              <Dialog.Header>
                <Dialog.Title>Delete passkey?</Dialog.Title>
              </Dialog.Header>
              <Dialog.Body>
                <Dialog.Description>
                  {deleteTarget
                    ? `“${passkeyLabel(deleteTarget)}” will no longer be able to sign in to your account. This cannot be undone.`
                    : ""}
                </Dialog.Description>
              </Dialog.Body>
              <Dialog.Footer>
                <Dialog.ActionTrigger asChild>
                  <Button variant="outline">Cancel</Button>
                </Dialog.ActionTrigger>
                <Button
                  colorPalette="red"
                  loading={deletePasskey.isPending}
                  onClick={() => {
                    if (deleteTarget) {
                      deletePasskey.mutate(
                        { id: deleteTarget.id },
                        { onSuccess: () => setDeleteTarget(null) },
                      );
                    }
                  }}
                >
                  Delete passkey
                </Button>
              </Dialog.Footer>
              <Dialog.CloseTrigger asChild>
                <CloseButton size="sm" />
              </Dialog.CloseTrigger>
            </Dialog.Content>
          </Dialog.Positioner>
        </Portal>
      </Dialog.Root>

      <Dialog.Root
        onOpenChange={(details) => {
          if (!details.open) {
            setRenameTarget(null);
          }
        }}
        open={renameTarget !== null}
      >
        <Portal>
          <Dialog.Backdrop />
          <Dialog.Positioner>
            <Dialog.Content>
              <Dialog.Header>
                <Dialog.Title>Rename passkey</Dialog.Title>
                <Dialog.CloseTrigger asChild>
                  <CloseButton size="sm" />
                </Dialog.CloseTrigger>
              </Dialog.Header>
              <Dialog.Body>
                <form id="rename-passkey" onSubmit={handleRename}>
                  <Field.Root id="passkey-name">
                    <Field.Label>Name</Field.Label>
                    <Input
                      autoFocus
                      id="passkey-name"
                      name="name"
                      onChange={(e) => setNewName(e.target.value)}
                      placeholder="e.g. MacBook Touch ID"
                      value={newName}
                    />
                  </Field.Root>
                </form>
              </Dialog.Body>
              <Dialog.Footer>
                <Dialog.ActionTrigger asChild>
                  <Button variant="outline">Cancel</Button>
                </Dialog.ActionTrigger>
                <Button
                  colorPalette="blue"
                  disabled={!newName.trim() || renamePasskey.isPending}
                  form="rename-passkey"
                  type="submit"
                >
                  {renamePasskey.isPending ? "Saving…" : "Save"}
                </Button>
              </Dialog.Footer>
            </Dialog.Content>
          </Dialog.Positioner>
        </Portal>
      </Dialog.Root>
    </section>
  );
}
