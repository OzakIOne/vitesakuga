import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "@tanstack/react-router";
import { Schema } from "effect";
import { useContext } from "react";
import { usersKeys } from "src/lib/users/users.queries";

import { useMutationWithFeedback } from "../mutations/mutation-feedback";
import { AuthClientContext } from "./client-context";

export const TWO_FACTOR_REDIRECT_KEY = "vitesakuga:two-factor:redirect";

export type TwoFactorRedirectData = {
  twoFactorRedirect: true;
  twoFactorMethods?: string[] | undefined;
};

export const TwoFactorRedirectSchema = Schema.Struct({
  twoFactorRedirect: Schema.Literal(true),
  twoFactorMethods: Schema.optional(Schema.Array(Schema.String)),
});

export function getTwoFactorRedirectUrl(): string {
  // SSR: `sessionStorage` is not exposed by Node unless the Web Storage
  // experimental flag is enabled, so the `in` check keeps this safe without
  // a `typeof window` guard.
  return "sessionStorage" in globalThis
    ? globalThis.sessionStorage.getItem(TWO_FACTOR_REDIRECT_KEY) || "/"
    : "/";
}

export function clearTwoFactorRedirectUrl(): void {
  if ("sessionStorage" in globalThis) {
    globalThis.sessionStorage.removeItem(TWO_FACTOR_REDIRECT_KEY);
  }
}

export function setTwoFactorRedirectUrl(url: string): void {
  if ("sessionStorage" in globalThis) {
    globalThis.sessionStorage.setItem(TWO_FACTOR_REDIRECT_KEY, url);
  }
}

function twoFactorErrorMessage(
  error: { message?: string | undefined } | undefined,
  fallback: string,
): Error {
  return new Error(error?.message || fallback);
}

export function useEnableTwoFactor() {
  const authClient = useContext(AuthClientContext);

  return useMutation({
    // Password is only required for users with a credential account. OAuth-only
    // users (GitHub/Google) enable 2FA without one; an empty string is sent so
    // the client request stays within the plugin's typed request shape and the
    // server (allowPasswordless) skips validation for those users.
    mutationFn: async ({ password }: { password?: string }) => {
      const { data, error } = await authClient.twoFactor.enable({
        password: password ?? "",
        method: "totp",
      });
      if (error) {
        throw twoFactorErrorMessage(
          error,
          "Failed to enable two-factor authentication",
        );
      }
      return data;
    },
  });
}

export function useVerifyTotp() {
  const authClient = useContext(AuthClientContext);

  return useMutation({
    mutationFn: async ({
      code,
      trustDevice,
    }: {
      code: string;
      trustDevice?: boolean;
    }) => {
      const { data, error } = await authClient.twoFactor.verifyTotp({
        code,
        trustDevice,
      });
      if (error) {
        throw twoFactorErrorMessage(error, "Failed to verify the code");
      }
      return data;
    },
  });
}

export function useVerifyBackupCode() {
  const authClient = useContext(AuthClientContext);

  return useMutation({
    mutationFn: async ({
      code,
      trustDevice,
    }: {
      code: string;
      trustDevice?: boolean;
    }) => {
      const { data, error } = await authClient.twoFactor.verifyBackupCode({
        code,
        trustDevice,
      });
      if (error) {
        throw twoFactorErrorMessage(error, "Failed to verify the backup code");
      }
      return data;
    },
  });
}

export function useGenerateBackupCodes() {
  const authClient = useContext(AuthClientContext);

  return useMutationWithFeedback({
    errorFallback: "Failed to generate backup codes",
    errorTitle: "Error generating backup codes",
    mutationFn: async ({ password }: { password?: string }) => {
      const { data, error } = await authClient.twoFactor.generateBackupCodes({
        password: password ?? "",
      });
      if (error) {
        throw twoFactorErrorMessage(error, "Failed to generate backup codes");
      }
      return data;
    },
    successDescription: "Your previous backup codes are no longer valid.",
    successTitle: "Backup codes regenerated",
  });
}

export function useDisableTwoFactor() {
  const queryClient = useQueryClient();
  const router = useRouter();
  const authClient = useContext(AuthClientContext);

  return useMutationWithFeedback({
    errorFallback: "Failed to disable two-factor authentication",
    errorTitle: "Error disabling 2FA",
    mutationFn: async ({ password }: { password?: string }) => {
      const { data, error } = await authClient.twoFactor.disable({
        password: password ?? "",
      });
      if (error) {
        throw twoFactorErrorMessage(
          error,
          "Failed to disable two-factor authentication",
        );
      }
      return data;
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: usersKeys.userInfo });
      await router.invalidate();
    },
    successDescription: "Two-factor authentication has been disabled.",
    successTitle: "2FA disabled",
  });
}
