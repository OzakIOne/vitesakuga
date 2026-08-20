import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate, useRouter } from "@tanstack/react-router";
import { Schema } from "effect";
import { useCallback, useContext } from "react";
import { usersKeys } from "src/lib/users/users.queries";

import { useMutationWithFeedback } from "../mutations/mutation-feedback";
import { AuthClientContext } from "./client-context";
import {
  setTwoFactorRedirectUrl,
  TwoFactorRedirectSchema,
} from "./two-factor.hooks";

export const passkeysKeys = {
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

  return useMutation({
    mutationFn: async ({
      email,
      password,
      captchaToken,
    }: LoginInput) => {
      const options: NonNullable<
        Parameters<typeof authClient.signIn.email>[1]
      > = {
        onSuccess: async (data) => {
          if (Schema.is(TwoFactorRedirectSchema)(data)) {
            // The 2FA challenge cookie is set and the client plugin
            // redirects to the verification page; keep the original
            // destination for after verification.
            setTwoFactorRedirectUrl(redirectUrl);
            return;
          }
          await queryClient.invalidateQueries({
            queryKey: usersKeys.userInfo,
          });
          await navigate({ to: redirectUrl });
        },
      };
      if (captchaToken) {
        options.headers = { "x-captcha-response": captchaToken };
      }
      return authClient.signIn.email(
        { email, password, callbackURL: redirectUrl },
        options,
      );
    },
  });
}

export function useSignUp(redirectUrl: string) {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const authClient = useContext(AuthClientContext);

  return useMutation({
    mutationFn: async ({
      name,
      email,
      password,
      captchaToken,
    }: SignUpInput) => {
      const options: NonNullable<
        Parameters<typeof authClient.signUp.email>[1]
      > = {
        onSuccess: async () => {
          await queryClient.invalidateQueries({
            queryKey: usersKeys.userInfo,
          });
          await navigate({ to: redirectUrl });
        },
      };
      if (captchaToken) {
        options.headers = { "x-captcha-response": captchaToken };
      }
      return authClient.signUp.email(
        { name, email, password, callbackURL: redirectUrl },
        options,
      );
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
    mutationFn: async ({ name, image }: { name: string; image: string }) =>
      authClient.updateUser({ name, image }),
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
    }) =>
      authClient.changePassword({
        currentPassword,
        newPassword,
        revokeOtherSessions: true,
      }),
    successDescription: "Your password has been successfully changed.",
    successTitle: "Password updated",
  });
}

export function useDeleteAccount() {
  const navigate = useNavigate();
  const authClient = useContext(AuthClientContext);

  return useMutationWithFeedback({
    errorFallback: "Failed to delete account",
    errorTitle: "Error deleting account",
    mutationFn: async () => authClient.deleteUser(),
    onSuccess: () => {
      void navigate({ to: "/" });
    },
    successDescription: "Your account has been successfully deleted.",
    successTitle: "Account deleted",
  });
}

export function useSocialLogin(redirectUrl: string) {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const authClient = useContext(AuthClientContext);

  const login = useCallback(
    async (provider: "github" | "google") => {
      await authClient.signIn.social(
        { provider, callbackURL: redirectUrl },
        {
          onSuccess: async () => {
            await queryClient.invalidateQueries({
              queryKey: usersKeys.userInfo,
            });
            await navigate({ to: redirectUrl });
          },
        },
      );
    },
    [redirectUrl, queryClient, navigate, authClient],
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

  return useMutation({
    mutationFn: async ({ autoFill }: { autoFill?: boolean }) => {
      const { data, error } = await authClient.signIn.passkey(
        autoFill === undefined ? {} : { autoFill },
      );
      if (error) {
        throw passkeyErrorMessage(error, "Passkey sign-in failed");
      }
      return data;
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: usersKeys.userInfo });
      await navigate({ to: redirectUrl });
    },
  });
}
