import { Portal } from "@ark-ui/react";
import { useQueryClient } from "@tanstack/react-query";
import { useRouter } from "@tanstack/react-router";
import { useState } from "react";
import { LuCopy, LuKeyRound, LuShieldCheck } from "react-icons/lu";
import QRCode from "react-qr-code";
import { Button, CloseButton } from "src/components/ui/button";
import { Field, Input } from "src/components/ui/field";
import { Dialog } from "src/components/ui/overlay";
import {
  PasswordInput,
  HiddenUsernameField,
} from "src/components/ui/password-input";
import { toaster } from "src/components/ui/toaster";
import { Text } from "src/components/ui/typography";
import {
  useDisableTwoFactor,
  useEnableTwoFactor,
  useGenerateBackupCodes,
  useVerifyTotp,
} from "src/lib/auth/two-factor.hooks";
import { usersKeys } from "src/lib/users/users.queries";

type EnableStep = "password" | "generating" | "qr" | "backup-codes";

function totpSecret(totpUri: string): string {
  try {
    return new URL(totpUri).searchParams.get("secret") ?? totpUri;
  } catch {
    return totpUri;
  }
}

async function copyText(text: string, label: string): Promise<void> {
  try {
    await navigator.clipboard.writeText(text);
    toaster.create({
      closable: true,
      description: `${label} copied to clipboard.`,
      duration: 2000,
      title: "Copied",
      type: "success",
    });
  } catch {
    toaster.create({
      closable: true,
      description: "Your browser blocked clipboard access.",
      duration: 3000,
      title: "Copy failed",
      type: "error",
    });
  }
}

type TwoFactorSectionProps = {
  enabled: boolean;
  /** Account email, used as the hidden username field for password managers. */
  email: string;
  /** Whether the current user has a credential (email/password) account. */
  hasPassword: boolean;
};

/**
 * Two-factor authentication (TOTP) management for the account page: enable
 * with an authenticator app (QR code + verification code), show backup codes,
 * regenerate them and disable 2FA.
 */
export function TwoFactorSection({
  email,
  enabled,
  hasPassword,
}: TwoFactorSectionProps) {
  const queryClient = useQueryClient();
  const router = useRouter();
  const enableMutation = useEnableTwoFactor();
  const verifyMutation = useVerifyTotp();
  const disableMutation = useDisableTwoFactor();
  const generateMutation = useGenerateBackupCodes();

  const [enableOpen, setEnableOpen] = useState(false);
  const [enableStep, setEnableStep] = useState<EnableStep>(
    hasPassword ? "password" : "generating",
  );
  const [enablePassword, setEnablePassword] = useState("");
  const [totpUri, setTotpUri] = useState("");
  const [backupCodes, setBackupCodes] = useState<string[]>([]);
  const [code, setCode] = useState("");
  const [enableError, setEnableError] = useState("");

  const [disableOpen, setDisableOpen] = useState(false);
  const [disablePassword, setDisablePassword] = useState("");

  const [regenerateOpen, setRegenerateOpen] = useState(false);
  const [regeneratePassword, setRegeneratePassword] = useState("");
  const [newBackupCodes, setNewBackupCodes] = useState<string[] | null>(null);

  const closeEnable = () => {
    setEnableOpen(false);
    setEnableStep(hasPassword ? "password" : "generating");
    setEnablePassword("");
    setTotpUri("");
    setBackupCodes([]);
    setCode("");
    setEnableError("");
  };

  const refreshUser = async () => {
    await queryClient.invalidateQueries({ queryKey: usersKeys.userInfo });
    await router.invalidate();
  };

  const startEnable = (password?: string) => {
    setEnableError("");
    enableMutation.mutate(hasPassword ? { password: password ?? "" } : {}, {
      onSuccess: (data) => {
        if (data.method !== "totp") {
          setEnableError("TOTP setup is not available.");
          return;
        }
        setTotpUri(data.totpURI);
        setBackupCodes(data.backupCodes);
        setEnableStep("qr");
      },
      onError: (error) => setEnableError(error.message),
    });
  };

  const handleEnableClick = () => {
    if (!hasPassword) {
      setEnableStep("generating");
      setEnableOpen(true);
      startEnable();
      return;
    }
    setEnableStep("password");
    setEnableOpen(true);
  };

  const handleEnable = (e: React.SubmitEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!enablePassword) {
      return;
    }
    startEnable(enablePassword);
  };

  const handleVerifyCode = (e: React.SubmitEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!/^\d{6}$/.test(code)) {
      setEnableError("Enter the 6-digit code from your authenticator app.");
      return;
    }
    setEnableError("");
    verifyMutation.mutate(
      { code },
      {
        onSuccess: async () => {
          await refreshUser();
          setEnableStep("backup-codes");
        },
        onError: (error) => setEnableError(error.message),
      },
    );
  };

  const handleDisable = (e: React.SubmitEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (hasPassword && !disablePassword) {
      return;
    }
    disableMutation.mutate(hasPassword ? { password: disablePassword } : {}, {
      onSuccess: () => {
        setDisableOpen(false);
        setDisablePassword("");
      },
    });
  };

  const handleDisableClick = () => {
    disableMutation.mutate(
      {},
      {
        onSuccess: () => {
          setDisableOpen(false);
          setDisablePassword("");
        },
      },
    );
  };

  const handleRegenerate = (e: React.SubmitEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (hasPassword && !regeneratePassword) {
      return;
    }
    generateMutation.mutate(
      hasPassword ? { password: regeneratePassword } : {},
      {
        onSuccess: (data) => {
          setNewBackupCodes(data.backupCodes);
          setRegeneratePassword("");
        },
      },
    );
  };

  const handleRegenerateClick = () => {
    generateMutation.mutate(
      {},
      {
        onSuccess: (data) => {
          setNewBackupCodes(data.backupCodes);
          setRegeneratePassword("");
        },
      },
    );
  };

  const dialogTitle =
    enableStep === "qr"
      ? "Scan the QR code"
      : enableStep === "backup-codes"
        ? "Save your backup codes"
        : enableStep === "generating"
          ? "Set up two-factor authentication"
          : "Enable two-factor authentication";

  return (
    <section className="border-t border-gray-200 pt-12">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold">Two-factor authentication</h2>
          <Text color="gray.500" fontSize="sm" mt={1}>
            {enabled
              ? "Protected with an authenticator app (TOTP)."
              : "Add a second verification step with an authenticator app."}
          </Text>
        </div>
        {enabled ? (
          <div className="flex gap-2">
            <Button
              colorPalette="blue"
              onClick={() => setRegenerateOpen(true)}
              size="sm"
              variant="outline"
            >
              <LuKeyRound />
              Backup codes
            </Button>
            <Button
              colorPalette="red"
              onClick={() => setDisableOpen(true)}
              size="sm"
              variant="outline"
            >
              <LuShieldCheck />
              Disable 2FA
            </Button>
          </div>
        ) : (
          <Button
            colorPalette="blue"
            disabled={enableMutation.isPending}
            onClick={handleEnableClick}
            size="sm"
          >
            <LuShieldCheck />
            Enable 2FA
          </Button>
        )}
      </div>

      {enabled && (
        <div className="mt-5 rounded-lg border border-green-200 bg-green-50 p-4 dark:border-green-900 dark:bg-green-950/40">
          <Text color="green.700" fontSize="sm">
            Two-factor authentication is on. You&apos;ll be asked for a code
            from your authenticator app when signing in.
          </Text>
        </div>
      )}

      {/* Enable 2FA dialog */}
      <Dialog.Root
        onOpenChange={(details) => {
          if (!details.open) {
            closeEnable();
          }
        }}
        open={enableOpen}
      >
        <Portal>
          <Dialog.Backdrop />
          <Dialog.Positioner>
            <Dialog.Content>
              <Dialog.Header>
                <Dialog.Title>{dialogTitle}</Dialog.Title>
                <Dialog.CloseTrigger asChild>
                  <CloseButton size="sm" />
                </Dialog.CloseTrigger>
              </Dialog.Header>
              <Dialog.Body>
                {enableStep === "password" && (
                  <form id="enable-2fa" onSubmit={handleEnable}>
                    <HiddenUsernameField value={email} />
                    <Text color="gray.500" fontSize="sm" mb={4}>
                      Enter your password to confirm. You&apos;ll then scan a QR
                      code with your authenticator app.
                    </Text>
                    <Field.Root>
                      <Field.Label>Password</Field.Label>
                      <PasswordInput
                        autoComplete="current-password"
                        onChange={(e) => setEnablePassword(e.target.value)}
                        placeholder="Enter your password"
                        value={enablePassword}
                      />
                    </Field.Root>
                  </form>
                )}

                {enableStep === "generating" && (
                  <Text color="gray.500" fontSize="sm">
                    {enableMutation.isPending
                      ? "Generating a setup key for your authenticator app\u2026"
                      : "Something went wrong. Try again."}
                  </Text>
                )}

                {enableStep === "qr" && (
                  <div className="flex flex-col items-center gap-4">
                    <Text color="gray.500" fontSize="sm" textAlign="center">
                      Scan this code with your authenticator app, then enter the
                      6-digit code it shows.
                    </Text>
                    <div
                      // oxlint-disable-next-line jsx-a11y/prefer-tag-over-role -- QRCode renders an inline <svg>; the wrapper is the accessible image
                      aria-label="Two-factor authentication setup QR code"
                      className="rounded-xl bg-white p-3"
                      role="img"
                    >
                      <QRCode size={160} value={totpUri} />
                    </div>
                    <div className="flex w-full items-center justify-between gap-3 rounded-lg border border-gray-200 p-3 dark:border-gray-700">
                      <div className="min-w-0">
                        <Text color="gray.500" fontSize="xs">
                          Manual entry key
                        </Text>
                        <Text
                          className="font-mono break-all"
                          fontSize="sm"
                          mt={0.5}
                        >
                          {totpSecret(totpUri)}
                        </Text>
                      </div>
                      <Button
                        aria-label="Copy manual entry key"
                        onClick={() =>
                          void copyText(totpSecret(totpUri), "Secret key")
                        }
                        size="sm"
                        variant="outline"
                      >
                        <LuCopy />
                      </Button>
                    </div>
                    <form
                      className="w-full space-y-4"
                      id="verify-2fa-code"
                      onSubmit={handleVerifyCode}
                    >
                      <Field.Root>
                        <Field.Label>6-digit code</Field.Label>
                        <Input
                          aria-label="6-digit verification code"
                          autoComplete="one-time-code"
                          autoFocus
                          inputMode="numeric"
                          maxLength={6}
                          onChange={(e) =>
                            setCode(e.target.value.replace(/\D/g, ""))
                          }
                          pattern="[0-9]*"
                          placeholder="000000"
                          spellCheck={false}
                          value={code}
                        />
                      </Field.Root>
                    </form>
                  </div>
                )}

                {enableStep === "backup-codes" && (
                  <div className="space-y-4">
                    <Text color="gray.500" fontSize="sm">
                      Two-factor authentication is enabled. Store these backup
                      codes somewhere safe — each one can be used once to sign
                      in if you lose access to your authenticator app.
                    </Text>
                    <div className="grid grid-cols-2 gap-2">
                      {backupCodes.map((backupCode) => (
                        <code
                          className="rounded-md border border-gray-200 px-3 py-2 text-center font-mono text-sm dark:border-gray-700"
                          key={backupCode}
                        >
                          {backupCode}
                        </code>
                      ))}
                    </div>
                    <Button
                      onClick={() =>
                        void copyText(backupCodes.join("\n"), "Backup codes")
                      }
                      size="sm"
                      variant="outline"
                    >
                      <LuCopy />
                      Copy all
                    </Button>
                  </div>
                )}

                {enableError && (
                  <p
                    className="mt-3 text-sm text-red-600 dark:text-red-400"
                    role="alert"
                  >
                    {enableError}
                  </p>
                )}
              </Dialog.Body>
              <Dialog.Footer>
                {enableStep === "password" && (
                  <>
                    <Dialog.ActionTrigger asChild>
                      <Button variant="outline">Cancel</Button>
                    </Dialog.ActionTrigger>
                    <Button
                      colorPalette="blue"
                      disabled={!enablePassword || enableMutation.isPending}
                      form="enable-2fa"
                      type="submit"
                    >
                      {enableMutation.isPending ? "Setting up..." : "Continue"}
                    </Button>
                  </>
                )}
                {enableStep === "generating" && (
                  <>
                    <Dialog.ActionTrigger asChild>
                      <Button variant="outline">Cancel</Button>
                    </Dialog.ActionTrigger>
                    <Button
                      colorPalette="blue"
                      disabled={enableMutation.isPending}
                      onClick={() => startEnable()}
                    >
                      {enableMutation.isPending ? "Setting up..." : "Try again"}
                    </Button>
                  </>
                )}
                {enableStep === "qr" && (
                  <Button
                    colorPalette="blue"
                    disabled={!/^\d{6}$/.test(code) || verifyMutation.isPending}
                    form="verify-2fa-code"
                    type="submit"
                  >
                    {verifyMutation.isPending ? "Verifying..." : "Verify code"}
                  </Button>
                )}
                {enableStep === "backup-codes" && (
                  <Button colorPalette="blue" onClick={closeEnable}>
                    Done
                  </Button>
                )}
              </Dialog.Footer>
            </Dialog.Content>
          </Dialog.Positioner>
        </Portal>
      </Dialog.Root>

      {/* Disable 2FA dialog */}
      <Dialog.Root
        onOpenChange={(details) => {
          if (!details.open) {
            setDisableOpen(false);
            setDisablePassword("");
          }
        }}
        open={disableOpen}
      >
        <Portal>
          <Dialog.Backdrop />
          <Dialog.Positioner>
            <Dialog.Content>
              <Dialog.Header>
                <Dialog.Title>Disable two-factor authentication</Dialog.Title>
                <Dialog.CloseTrigger asChild>
                  <CloseButton size="sm" />
                </Dialog.CloseTrigger>
              </Dialog.Header>
              <Dialog.Body>
                {hasPassword ? (
                  <form id="disable-2fa" onSubmit={handleDisable}>
                    <HiddenUsernameField value={email} />
                    <Text color="gray.500" fontSize="sm" mb={4}>
                      Your account will only be protected by your password.
                      Enter your password to confirm.
                    </Text>
                    <Field.Root>
                      <Field.Label>Password</Field.Label>
                      <PasswordInput
                        autoComplete="current-password"
                        onChange={(e) => setDisablePassword(e.target.value)}
                        placeholder="Enter your password"
                        value={disablePassword}
                      />
                    </Field.Root>
                  </form>
                ) : (
                  <Text color="gray.500" fontSize="sm" mb={4}>
                    Your account will only be protected by your GitHub or Google
                    sign-in. Confirm to turn off two-factor authentication.
                  </Text>
                )}
              </Dialog.Body>
              <Dialog.Footer>
                <Dialog.ActionTrigger asChild>
                  <Button variant="outline">Cancel</Button>
                </Dialog.ActionTrigger>
                <Button
                  colorPalette="red"
                  disabled={
                    (hasPassword && !disablePassword) ||
                    disableMutation.isPending
                  }
                  form={hasPassword ? "disable-2fa" : undefined}
                  onClick={hasPassword ? undefined : handleDisableClick}
                  type={hasPassword ? "submit" : "button"}
                >
                  {disableMutation.isPending ? "Disabling..." : "Disable 2FA"}
                </Button>
              </Dialog.Footer>
            </Dialog.Content>
          </Dialog.Positioner>
        </Portal>
      </Dialog.Root>

      {/* Regenerate backup codes dialog */}
      <Dialog.Root
        onOpenChange={(details) => {
          if (!details.open) {
            setRegenerateOpen(false);
            setRegeneratePassword("");
            setNewBackupCodes(null);
          }
        }}
        open={regenerateOpen}
      >
        <Portal>
          <Dialog.Backdrop />
          <Dialog.Positioner>
            <Dialog.Content>
              <Dialog.Header>
                <Dialog.Title>Backup codes</Dialog.Title>
                <Dialog.CloseTrigger asChild>
                  <CloseButton size="sm" />
                </Dialog.CloseTrigger>
              </Dialog.Header>
              <Dialog.Body>
                {newBackupCodes ? (
                  <div className="space-y-4">
                    <Text color="gray.500" fontSize="sm">
                      Your previous backup codes are no longer valid. Store
                      these new ones somewhere safe.
                    </Text>
                    <div className="grid grid-cols-2 gap-2">
                      {newBackupCodes.map((backupCode) => (
                        <code
                          className="rounded-md border border-gray-200 px-3 py-2 text-center font-mono text-sm dark:border-gray-700"
                          key={backupCode}
                        >
                          {backupCode}
                        </code>
                      ))}
                    </div>
                    <Button
                      onClick={() =>
                        void copyText(newBackupCodes.join("\n"), "Backup codes")
                      }
                      size="sm"
                      variant="outline"
                    >
                      <LuCopy />
                      Copy all
                    </Button>
                  </div>
                ) : hasPassword ? (
                  <form id="regenerate-2fa" onSubmit={handleRegenerate}>
                    <HiddenUsernameField value={email} />
                    <Text color="gray.500" fontSize="sm" mb={4}>
                      Generate a fresh set of backup codes. Your current codes
                      will stop working immediately. Enter your password to
                      confirm.
                    </Text>
                    <Field.Root>
                      <Field.Label>Password</Field.Label>
                      <PasswordInput
                        autoComplete="current-password"
                        onChange={(e) => setRegeneratePassword(e.target.value)}
                        placeholder="Enter your password"
                        value={regeneratePassword}
                      />
                    </Field.Root>
                  </form>
                ) : (
                  <Text color="gray.500" fontSize="sm" mb={4}>
                    Generate a fresh set of backup codes. Your current codes
                    will stop working immediately.
                  </Text>
                )}
              </Dialog.Body>
              <Dialog.Footer>
                {newBackupCodes ? (
                  <Button
                    colorPalette="blue"
                    onClick={() => {
                      setRegenerateOpen(false);
                      setNewBackupCodes(null);
                    }}
                  >
                    Done
                  </Button>
                ) : (
                  <>
                    <Dialog.ActionTrigger asChild>
                      <Button variant="outline">Cancel</Button>
                    </Dialog.ActionTrigger>
                    <Button
                      colorPalette="red"
                      disabled={
                        (hasPassword && !regeneratePassword) ||
                        generateMutation.isPending
                      }
                      form={hasPassword ? "regenerate-2fa" : undefined}
                      onClick={hasPassword ? undefined : handleRegenerateClick}
                      type={hasPassword ? "submit" : "button"}
                    >
                      {generateMutation.isPending
                        ? "Generating..."
                        : "Generate new codes"}
                    </Button>
                  </>
                )}
              </Dialog.Footer>
            </Dialog.Content>
          </Dialog.Positioner>
        </Portal>
      </Dialog.Root>
    </section>
  );
}
