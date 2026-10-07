import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate, useRouter } from "@tanstack/react-router";
import { Schema } from "effect";
import { useCallback, useContext } from "react";
import { usersKeys } from "src/lib/users/users.queries";

import { useMutationWithFeedback } from "../mutations/mutation-feedback";
import { getSafeAuthRedirectUrl } from "./auth-redirect";
import { AuthClientContext } from "./client-context";
import { deleteAccount } from "./delete-account";
import {
  clearTwoFactorRedirectUrl,
  setTwoFactorRedirectUrl,
} from "./two-factor.hooks";
import { TwoFactorRedirectSchema } from "./two-factor.schema";

const passkeysKeys = {
  all: ["auth", "passkeys"] as const,
};

export type LoginInput = {
  email: string;
  password: string;
  captchaToken?: string;
};

export type SignUpInput = {
  name: string;
  email: string;
  password: string;
  captchaToken?: string;
};

function passkeyErrorMessage(
  error: { message?: string | undefined } | undefined,
  fallback: string,
): Error {
  return new Error(error?.message || fallback);
}

export function useLogin(redirectUrl: string) {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const authClient = useContext(AuthClientContext);
  const safeRedirectUrl = getSafeAuthRedirectUrl(redirectUrl);

  return useMutation({
    mutationFn: async ({ email, password, captchaToken }: LoginInput) => {
      setTwoFactorRedirectUrl(safeRedirectUrl);
      const options: NonNullable<
        Parameters<typeof authClient.signIn.email>[1]
      > = {
        onSuccess: async (data) => {
          if (Schema.is(TwoFactorRedirectSchema)(data)) {
            // The 2FA challenge cookie is set and the client plugin
            // redirects to the verification page; keep the original
            // destination for after verification.
            setTwoFactorRedirectUrl(safeRedirectUrl);
            return;
          }
          clearTwoFactorRedirectUrl();
          await queryClient.invalidateQueries({
            queryKey: usersKeys.userInfo,
          });
          await navigate({ to: safeRedirectUrl });
        },
      };
      if (captchaToken) {
        options.headers = { "x-captcha-response": captchaToken };
      }
      return authClient.signIn
        .email({ email, password, callbackURL: safeRedirectUrl }, options)
        .then(({ data, error }) => {
          // The Better Auth client resolves with `{ error }` instead of
          // rejecting; surface it so React Query's `onError` fires.
          if (error) {
            throw new Error(error.message || "Failed to sign in");
          }
          return data;
        });
    },
    onError: () => clearTwoFactorRedirectUrl(),
  });
}

export function useSignUp(redirectUrl: string) {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const authClient = useContext(AuthClientContext);
  const safeRedirectUrl = getSafeAuthRedirectUrl(redirectUrl);

  return useMutation({
    mutationFn: async ({
      name,
      email,
      password,
      captchaToken,
    }: SignUpInput) => {
      const options: NonNullable<
        Parameters<typeof authClient.signUp.email>[1]
      > = {};
      if (captchaToken) {
        options.headers = { "x-captcha-response": captchaToken };
      }
      const { data, error } = await authClient.signUp.email(
        { name, email, password, callbackURL: safeRedirectUrl },
        options,
      );
      // The Better Auth client resolves with `{ error }` instead of
      // rejecting; surface it so React Query's `onError` fires.
      if (error) {
        throw new Error(error.message || "Failed to sign up");
      }
      return data;
    },
    onSuccess: async (data) => {
      await queryClient.invalidateQueries({
        queryKey: usersKeys.userInfo,
      });
      if (data?.user?.emailVerified) {
        await navigate({ to: safeRedirectUrl });
      }
    },
  });
}

export function useVerifyEmail(redirectUrl: string) {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const authClient = useContext(AuthClientContext);
  const safeRedirectUrl = getSafeAuthRedirectUrl(redirectUrl);

  return useMutation({
    mutationFn: async ({ email, otp }: { email: string; otp: string }) => {
      setTwoFactorRedirectUrl(safeRedirectUrl);
      const { data, error } = await authClient.emailOtp.verifyEmail({
        email,
        otp,
      });
      if (error) {
        throw new Error(error.message || "Failed to verify email");
      }
      return data;
    },
    onSuccess: async (data) => {
      if (Schema.is(TwoFactorRedirectSchema)(data)) {
        setTwoFactorRedirectUrl(safeRedirectUrl);
        return;
      }
      clearTwoFactorRedirectUrl();
      await queryClient.invalidateQueries({
        queryKey: usersKeys.userInfo,
      });
      await navigate({ to: safeRedirectUrl });
    },
    onError: () => clearTwoFactorRedirectUrl(),
  });
}

export function useResendEmailVerification() {
  const authClient = useContext(AuthClientContext);

  return useMutation({
    mutationFn: async ({ email }: { email: string }) => {
      const { error } = await authClient.emailOtp.sendVerificationOtp({
        email,
        type: "email-verification",
      });
      if (error) {
        throw new Error(error.message || "Failed to resend verification code");
      }
    },
  });
}

export function useUpdateProfile() {
  const queryClient = useQueryClient();
  const router = useRouter();
  const authClient = useContext(AuthClientContext);

  return useMutationWithFeedback({
    errorFallback: "Failed to update profile",
    errorTitle: "Error updating profile",
    mutationFn: async ({
      image,
      name,
      username,
    }: {
      name: string;
      image: string;
      username: string;
    }) => {
      const { error } = await authClient.updateUser({ name, image, username });
      // The Better Auth client resolves with `{ error }` instead of
      // rejecting; surface it so React Query's `onError` fires (e.g. the
      // username plugin's "already taken").
      if (error) {
        throw new Error(error.message || "Failed to update profile");
      }
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: usersKeys.userInfo,
      });
      await router.invalidate();
    },
    successDescription: "Your profile has been successfully updated.",
    successTitle: "Profile updated",
  });
}

export function useChangePassword() {
  const authClient = useContext(AuthClientContext);

  return useMutationWithFeedback({
    errorFallback: "Failed to change password",
    errorTitle: "Error changing password",
    mutationFn: async ({
      currentPassword,
      newPassword,
    }: {
      currentPassword: string;
      newPassword: string;
    }) => {
      const { error, data } = await authClient.changePassword({
        currentPassword,
        newPassword,
        revokeOtherSessions: true,
      });

      if (error) {
        throw new Error(error.message ?? "Failed to change password");
      }

      return data;
    },
    successDescription: "Your password has been successfully changed.",
    successTitle: "Password updated",
  });
}

export type DeleteAccountInput = {
  password?: string | undefined;
};

export function useDeleteAccount() {
  const navigate = useNavigate();
  const authClient = useContext(AuthClientContext);
  const queryClient = useQueryClient();

  return useMutationWithFeedback({
    errorFallback: "Failed to delete account",
    errorTitle: "Error deleting account",
    mutationFn: async ({ password }: DeleteAccountInput) => {
      await deleteAccount({ data: password ? { password } : {} });
      // The server removed every session; sign out clears the auth cookie
      // and the cached user state on this device.
      await authClient.signOut();
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: usersKeys.userInfo,
      });
      await navigate({ to: "/" });
    },
    successDescription:
      "Your account has been deleted. Your posts and comments remain visible under “Deleted user”.",
    successTitle: "Account deleted",
  });
}

export function useSocialLogin(redirectUrl: string) {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const authClient = useContext(AuthClientContext);
  const safeRedirectUrl = getSafeAuthRedirectUrl(redirectUrl);

  const login = useCallback(
    async (provider: "github" | "google") => {
      setTwoFactorRedirectUrl(safeRedirectUrl);
      const { error } = await authClient.signIn.social(
        { provider, callbackURL: safeRedirectUrl },
        {
          onSuccess: async () => {
            await queryClient.invalidateQueries({
              queryKey: usersKeys.userInfo,
            });
            await navigate({ to: safeRedirectUrl });
          },
        },
      );
      // The Better Auth client resolves with `{ error }` instead of
      // rejecting; surface it to callers.
      if (error) {
        clearTwoFactorRedirectUrl();
        throw new Error(error.message || `Failed to sign in with ${provider}`);
      }
    },
    [safeRedirectUrl, queryClient, navigate, authClient],
  );

  return login;
}

export function usePasskeys() {
  const authClient = useContext(AuthClientContext);

  return useQuery({
    queryKey: passkeysKeys.all,
    queryFn: async () => {
      const { data, error } = await authClient.passkey.listUserPasskeys();
      if (error) {
        throw passkeyErrorMessage(error, "Failed to load passkeys");
      }
      return data ?? [];
    },
  });
}

export function useAddPasskey() {
  const queryClient = useQueryClient();
  const authClient = useContext(AuthClientContext);

  return useMutationWithFeedback({
    errorFallback: "Failed to add passkey",
    errorTitle: "Error adding passkey",
    mutationFn: async ({ name }: { name?: string }) => {
      const { data, error } = await authClient.passkey.addPasskey(
        name ? { name } : {},
      );
      if (error) {
        throw passkeyErrorMessage(error, "Failed to add passkey");
      }
      return data;
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: passkeysKeys.all });
    },
    successDescription: "Your passkey has been successfully added.",
    successTitle: "Passkey added",
  });
}

export function useRenamePasskey() {
  const queryClient = useQueryClient();
  const authClient = useContext(AuthClientContext);

  return useMutationWithFeedback({
    errorFallback: "Failed to rename passkey",
    errorTitle: "Error renaming passkey",
    mutationFn: async ({ id, name }: { id: string; name: string }) => {
      const { data, error } = await authClient.passkey.updatePasskey({
        id,
        name,
      });
      if (error) {
        throw passkeyErrorMessage(error, "Failed to rename passkey");
      }
      return data;
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: passkeysKeys.all });
    },
    successDescription: "Your passkey has been successfully renamed.",
    successTitle: "Passkey renamed",
  });
}

export function useDeletePasskey() {
  const queryClient = useQueryClient();
  const authClient = useContext(AuthClientContext);

  return useMutationWithFeedback({
    errorFallback: "Failed to delete passkey",
    errorTitle: "Error deleting passkey",
    mutationFn: async ({ id }: { id: string }) => {
      const { data, error } = await authClient.passkey.deletePasskey({ id });
      if (error) {
        throw passkeyErrorMessage(error, "Failed to delete passkey");
      }
      return data;
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: passkeysKeys.all });
    },
    successDescription: "Your passkey has been successfully removed.",
    successTitle: "Passkey deleted",
  });
}

export function useSignInWithPasskey(redirectUrl: string) {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const authClient = useContext(AuthClientContext);
  const safeRedirectUrl = getSafeAuthRedirectUrl(redirectUrl);

  return useMutation({
    mutationFn: async ({ autoFill }: { autoFill?: boolean }) => {
      setTwoFactorRedirectUrl(safeRedirectUrl);
      const { data, error } = await authClient.signIn.passkey(
        autoFill === undefined ? {} : { autoFill },
      );
      if (error) {
        clearTwoFactorRedirectUrl();
        throw passkeyErrorMessage(error, "Passkey sign-in failed");
      }
      return data;
    },
    onSuccess: async (data) => {
      if (Schema.is(TwoFactorRedirectSchema)(data)) {
        setTwoFactorRedirectUrl(safeRedirectUrl);
        return;
      }
      clearTwoFactorRedirectUrl();
      await queryClient.invalidateQueries({ queryKey: usersKeys.userInfo });
      await navigate({ to: safeRedirectUrl });
    },
    onError: () => clearTwoFactorRedirectUrl(),
  });
}
