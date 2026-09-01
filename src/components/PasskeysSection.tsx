import { Portal } from "@ark-ui/react";
import { getAuthenticatorName, type Passkey } from "@better-auth/passkey";
import { useState } from "react";
import { LuFingerprint, LuPencil, LuTrash2 } from "react-icons/lu";
import { Button, CloseButton } from "src/components/ui/button";
import { Field, Input } from "src/components/ui/field";
import { Dialog } from "src/components/ui/overlay";
import { Text } from "src/components/ui/typography";
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

/**
 * Passkey management for the account page: list, add, rename and delete the
 * WebAuthn credentials attached to the signed-in user.
 */
export function PasskeysSection() {
  const addPasskey = useAddPasskey();
  const deletePasskey = useDeletePasskey();
  const renamePasskey = useRenamePasskey();
  const { data: passkeys = [], isLoading } = usePasskeys();
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
    <section className="border-t border-gray-200 pt-12">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold">Passkeys</h2>
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
          {addPasskey.isPending ? "Registering..." : "Add passkey"}
        </Button>
      </div>

      <div className="mt-5 space-y-3">
        {isLoading ? (
          <Text color="gray.500" fontSize="sm">
            Loading passkeys...
          </Text>
        ) : passkeys.length === 0 ? (
          <div className="rounded-lg border border-dashed border-gray-300 p-5 text-center dark:border-gray-700">
            <Text color="gray.500" fontSize="sm">
              You don&apos;t have any passkeys yet. Add one to skip passwords on
              your next sign-in.
            </Text>
          </div>
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
                    {passkey.transports
                      ? ` \u00b7 ${passkey.transports.replaceAll(",", ", ")}`
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
                <p>
                  {deleteTarget
                    ? `“${passkeyLabel(deleteTarget)}” will no longer be able to sign in to your account. This cannot be undone.`
                    : ""}
                </p>
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
                  <Field.Root>
                    <Field.Label>Name</Field.Label>
                    <Input
                      autoFocus
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
                  {renamePasskey.isPending ? "Saving..." : "Save"}
                </Button>
              </Dialog.Footer>
            </Dialog.Content>
          </Dialog.Positioner>
        </Portal>
      </Dialog.Root>
    </section>
  );
}
