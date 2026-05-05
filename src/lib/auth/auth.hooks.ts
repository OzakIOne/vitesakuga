import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate, useRouter } from "@tanstack/react-router";
import { useCallback } from "react";
import { toaster } from "src/components/ui/toaster";
import { usersKeys } from "src/lib/users/users.queries";

import authClient from "./client";

export function useLogin(redirectUrl: string) {
  const queryClient = useQueryClient();
  const navigate = useNavigate();

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
            await queryClient.invalidateQueries({ queryKey: usersKeys.userInfo });
            await navigate({ to: redirectUrl });
          },
        },
      ),
  });
}

export function useSignUp(redirectUrl: string) {
  const queryClient = useQueryClient();
  const navigate = useNavigate();

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
            await queryClient.invalidateQueries({ queryKey: usersKeys.userInfo });
            await navigate({ to: redirectUrl });
          },
        },
      ),
  });
}

export function useUpdateProfile() {
  const router = useRouter();

  return useMutation({
    mutationFn: async ({ name, image }: { name: string; image: string }) =>
      authClient.updateUser({ name, image }),
    onError: (error: Error) => {
      toaster.create({
        closable: true,
        description: String(error),
        duration: 5000,
        title: "Error updating profile",
        type: "error",
      });
    },
    onSuccess: async () => {
      await router.invalidate();
      toaster.create({
        closable: true,
        description: "Your profile has been successfully updated.",
        duration: 3000,
        title: "Profile updated",
        type: "success",
      });
    },
  });
}

export function useChangePassword() {
  return useMutation({
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
    onError: (error: Error) => {
      toaster.create({
        closable: true,
        description: String(error),
        duration: 5000,
        title: "Error changing password",
        type: "error",
      });
    },
    onSuccess: () => {
      toaster.create({
        closable: true,
        description: "Your password has been successfully changed.",
        duration: 3000,
        title: "Password updated",
        type: "success",
      });
    },
  });
}

export function useDeleteAccount() {
  const navigate = useNavigate();

  return useMutation({
    mutationFn: async () => authClient.deleteUser(),
    onError: (error: Error) => {
      toaster.create({
        closable: true,
        description: String(error),
        duration: 5000,
        title: "Error deleting account",
        type: "error",
      });
    },
    onSuccess: () => {
      toaster.create({
        closable: true,
        description: "Your account has been successfully deleted.",
        duration: 3000,
        title: "Account deleted",
        type: "success",
      });
      void navigate({ to: "/" });
    },
  });
}

export function useSocialLogin(redirectUrl: string) {
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  const login = useCallback(
    async (provider: "github" | "google") => {
      await authClient.signIn.social(
        { provider, callbackURL: redirectUrl },
        {
          onSuccess: async () => {
            await queryClient.invalidateQueries({ queryKey: usersKeys.userInfo });
            await navigate({ to: redirectUrl });
          },
        },
      );
    },
    [redirectUrl, queryClient, navigate],
  );

  return login;
}
