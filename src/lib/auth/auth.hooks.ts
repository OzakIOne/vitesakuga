import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate, useRouter } from "@tanstack/react-router";
import { useCallback, useContext } from "react";
import { usersKeys } from "src/lib/users/users.queries";

import { useMutationWithFeedback } from "../mutations/mutation-feedback";
import { AuthClientContext } from "./client-context";

export function useLogin(redirectUrl: string) {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const authClient = useContext(AuthClientContext);

  return useMutation({
    mutationFn: async ({
      email,
      password,
    }: {
      email: string;
      password: string;
    }) =>
      authClient.signIn.email(
        { email, password, callbackURL: redirectUrl },
        {
          onSuccess: async () => {
            await queryClient.invalidateQueries({
              queryKey: usersKeys.userInfo,
            });
            await navigate({ to: redirectUrl });
          },
        },
      ),
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
    }: {
      name: string;
      email: string;
      password: string;
    }) =>
      authClient.signUp.email(
        { name, email, password, callbackURL: redirectUrl },
        {
          onSuccess: async () => {
            await queryClient.invalidateQueries({
              queryKey: usersKeys.userInfo,
            });
            await navigate({ to: redirectUrl });
          },
        },
      ),
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
