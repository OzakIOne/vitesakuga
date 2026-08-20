import { useQueryClient } from "@tanstack/react-query";
import {
  createFileRoute,
  Link,
  redirect,
  useNavigate,
  useRouter,
} from "@tanstack/react-router";
import { useState } from "react";
import { LuShieldCheck } from "react-icons/lu";
import { Button } from "src/components/ui/button";
import { Checkbox, Field, Input } from "src/components/ui/field";
import { Box } from "src/components/ui/layout";
import { Heading, Text } from "src/components/ui/typography";
import {
  clearTwoFactorRedirectUrl,
  getTwoFactorRedirectUrl,
  useVerifyBackupCode,
  useVerifyTotp,
} from "src/lib/auth/two-factor.hooks";
import { usersKeys } from "src/lib/users/users.queries";

export const Route = createFileRoute("/two-factor")({
  beforeLoad: ({ context }) => {
    if (context.user) {
      throw redirect({ to: "/" });
    }
  },
  component: TwoFactorVerifyPage,
});

function TwoFactorVerifyPage() {
  const queryClient = useQueryClient();
  const router = useRouter();
  const navigate = useNavigate();
  const verifyTotp = useVerifyTotp();
  const verifyBackupCode = useVerifyBackupCode();

  const [mode, setMode] = useState<"totp" | "backup-code">("totp");
  const [code, setCode] = useState("");
  const [trustDevice, setTrustDevice] = useState(false);
  const [error, setError] = useState("");

  const isPending =
    mode === "totp" ? verifyTotp.isPending : verifyBackupCode.isPending;

  const handleSubmit = async (e: React.SubmitEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!code) {
      return;
    }
    setError("");
    try {
      if (mode === "totp") {
        await verifyTotp.mutateAsync({ code, trustDevice });
      } else {
        await verifyBackupCode.mutateAsync({ code, trustDevice });
      }
      const redirectUrl = getTwoFactorRedirectUrl();
      clearTwoFactorRedirectUrl();
      await queryClient.invalidateQueries({ queryKey: usersKeys.userInfo });
      await router.invalidate();
      await navigate({ to: redirectUrl });
    } catch (mutationError) {
      setError(
        mutationError instanceof Error
          ? mutationError.message
          : "Verification failed",
      );
    }
  };

  return (
    <Box className="flex min-h-dvh flex-col items-center px-4 py-16 sm:px-8">
      <div className="w-full max-w-md space-y-8 rounded-2xl px-8 py-12 sm:px-12 sm:py-14">
        <div className="text-center">
          <LuShieldCheck
            aria-hidden="true"
            className="mx-auto mb-4 text-blue-600"
            size={36}
          />
          <Heading size="lg">Two-factor verification</Heading>
          <Text color="gray.500" fontSize="sm" mt={2}>
            {mode === "totp"
              ? "Enter the 6-digit code from your authenticator app to finish signing in."
              : "Enter one of your backup codes to finish signing in."}
          </Text>
        </div>

        <form className="space-y-5" onSubmit={handleSubmit}>
          <Field.Root required>
            <Field.Label>
              {mode === "totp" ? "Authenticator code" : "Backup code"}
            </Field.Label>
            <Input
              autoFocus
              inputMode={mode === "totp" ? "numeric" : "text"}
              maxLength={mode === "totp" ? 6 : undefined}
              onChange={(e) =>
                setCode(
                  mode === "totp"
                    ? e.target.value.replace(/\D/g, "")
                    : e.target.value,
                )
              }
              pattern={mode === "totp" ? "[0-9]*" : undefined}
              placeholder={mode === "totp" ? "000000" : "Enter backup code"}
              value={code}
            />
          </Field.Root>

          <Checkbox.Root
            checked={trustDevice}
            onCheckedChange={(details) =>
              setTrustDevice(details.checked === true)
            }
          >
            <Checkbox.HiddenInput />
            <Checkbox.Control>
              <Checkbox.Indicator />
            </Checkbox.Control>
            <Checkbox.Label>Trust this device for 30 days</Checkbox.Label>
          </Checkbox.Root>

          <Button
            className="w-full"
            colorPalette="blue"
            disabled={!code || isPending}
            type="submit"
          >
            {isPending ? "Verifying..." : "Verify"}
          </Button>

          <button
            className="w-full text-center text-sm text-blue-600 hover:underline dark:text-blue-400"
            onClick={() => {
              setMode(mode === "totp" ? "backup-code" : "totp");
              setCode("");
              setError("");
            }}
            type="button"
          >
            {mode === "totp"
              ? "Use a backup code instead"
              : "Use my authenticator app instead"}
          </button>

          {error && (
            <p className="text-center text-sm text-red-600 dark:text-red-400">
              {error}
            </p>
          )}
        </form>

        <Text color="gray.400" fontSize="sm" textAlign="center">
          <Link className="hover:underline" to="/login">
            Back to login
          </Link>
        </Text>
      </div>
    </Box>
  );
}
