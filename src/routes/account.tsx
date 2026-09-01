import { Portal } from "@ark-ui/react";
import { useForm } from "@tanstack/react-form";
import { createFileRoute, Link, redirect } from "@tanstack/react-router";
import { useState } from "react";
import { LuImage, LuUser } from "react-icons/lu";
import { FieldInfo } from "src/components/form/FieldInfo";
import { PasskeysSection } from "src/components/PasskeysSection";
import { TwoFactorSection } from "src/components/TwoFactorSection";
import { Button, CloseButton } from "src/components/ui/button";
import { Field, Input, InputGroup } from "src/components/ui/field";
import { Box } from "src/components/ui/layout";
import { Avatar, AvatarGroup } from "src/components/ui/media";
import { Dialog } from "src/components/ui/overlay";
import { PasswordInput } from "src/components/ui/password-input";
import { Heading, Text } from "src/components/ui/typography";
import { getAccountSecurity } from "src/lib/auth/account-security";
import {
  useChangePassword,
  useDeleteAccount,
  useUpdateProfile,
} from "src/lib/auth/auth.hooks";
import { passwordSchema, profileSchema } from "src/lib/auth/auth.schemas";
import { toStandardSchemaV1Strict } from "src/lib/effect/schema.utils";
import { usersKeys } from "src/lib/users/users.queries";

const memberSinceFormatter = new Intl.DateTimeFormat("en-US", {
  month: "long",
  year: "numeric",
  day: "numeric",
  timeZone: "UTC",
});

type DeleteAccountDialogProps = {
  hasPassword: boolean;
  isPending: boolean;
  onConfirm: (password?: string) => void;
};

function DeleteAccountDialog({
  hasPassword,
  isPending,
  onConfirm,
}: DeleteAccountDialogProps) {
  const [password, setPassword] = useState("");

  const canConfirm = !hasPassword || password.trim().length > 0;

  return (
    <Dialog.Root
      onOpenChange={(details) => {
        if (!details.open) {
          setPassword("");
        }
      }}
      role="alertdialog"
    >
      <Dialog.Trigger asChild>
        <Button colorPalette="red" flexShrink={0} size="sm" variant="outline">
          Delete account
        </Button>
      </Dialog.Trigger>
      <Portal>
        <Dialog.Backdrop />
        <Dialog.Positioner>
          <Dialog.Content>
            <Dialog.Header>
              <Dialog.Title>Are you sure?</Dialog.Title>
            </Dialog.Header>
            <Dialog.Body>
              <Text mb={4}>
                This action cannot be undone. Your posts and comments will
                remain publicly visible, published as &ldquo;Deleted
                user&rdquo;. All your other data will be permanently removed.
              </Text>
              {hasPassword && (
                <Field.Root>
                  <Field.Label>Confirm your password</Field.Label>
                  <PasswordInput
                    autoComplete="current-password"
                    className="h-12 w-full"
                    onChange={(e) => {
                      setPassword(e.target.value);
                    }}
                    placeholder="Enter your password"
                    value={password}
                  />
                </Field.Root>
              )}
            </Dialog.Body>
            <Dialog.Footer>
              <Dialog.ActionTrigger asChild>
                <Button variant="outline">Cancel</Button>
              </Dialog.ActionTrigger>
              <Button
                colorPalette="red"
                disabled={!canConfirm}
                loading={isPending}
                onClick={() => onConfirm(hasPassword ? password : undefined)}
              >
                Confirm account deletion
              </Button>
            </Dialog.Footer>
            <Dialog.CloseTrigger asChild>
              <CloseButton size="sm" />
            </Dialog.CloseTrigger>
          </Dialog.Content>
        </Dialog.Positioner>
      </Portal>
    </Dialog.Root>
  );
}

export const Route = createFileRoute("/account")({
  beforeLoad: async ({ context, location }) => {
    if (!context.user) {
      throw redirect({
        search: { redirect: location.pathname },
        to: "/login",
      });
    }
    const security = await context.queryClient.query({
      queryKey: usersKeys.accountSecurity,
      queryFn: async ({ signal }) => getAccountSecurity({ signal }),
      staleTime: 60 * 60 * 1000,
    });
    return { user: context.user, hasPassword: security.hasPassword };
  },
  component: RouteComponent,
});

function RouteComponent() {
  const { hasPassword, user } = Route.useRouteContext();
  const updateProfileMutation = useUpdateProfile();
  const changePasswordMutation = useChangePassword();
  const deleteAccountMutation = useDeleteAccount();

  const profileForm = useForm({
    defaultValues: {
      image: user.image ?? "",
      name: user.name,
    },
    onSubmit: async ({ value }) => {
      updateProfileMutation.mutate(value);
    },
    validators: {
      onChange: toStandardSchemaV1Strict(profileSchema),
    },
  });

  const passwordForm = useForm({
    defaultValues: {
      currentPassword: "",
      newPassword: "",
    },
    onSubmit: async ({ value, formApi }) => {
      changePasswordMutation.mutate(value, {
        onSuccess: () => formApi.reset(),
      });
    },
    validators: {
      onChange: toStandardSchemaV1Strict(passwordSchema),
    },
  });

  const memberSince = memberSinceFormatter.format(new Date(user.createdAt));

  return (
    <Box className="flex min-h-dvh flex-col items-center px-4 py-16 sm:px-8">
      <div className="w-full max-w-lg space-y-12 rounded-2xl px-8 py-12 sm:px-12 sm:py-14">
        <div className="flex items-center gap-5">
          <AvatarGroup>
            <Avatar.Root size="2xl">
              <Avatar.Fallback />
              <Avatar.Image
                className="rounded-full"
                src={user.image ?? undefined}
              />
            </Avatar.Root>
          </AvatarGroup>
          <div className="min-w-0 flex-1">
            <Heading size="lg">{user.name}</Heading>
            <Text color="gray.600">{user.email}</Text>
            <Text color="gray.400" fontSize="sm" mt={1}>
              Member since {memberSince}
            </Text>
          </div>
        </div>

        <div className="space-y-12">
          <section className="flex items-center justify-between gap-4 rounded-2xl border border-gray-200 p-5 dark:border-gray-700">
            <div>
              <Heading as="h2" mb={1} size="md">
                Playlists
              </Heading>
              <Text color="gray.500" fontSize="sm">
                Toggle visibility and manage the posts in your playlists.
              </Text>
            </div>
            <Button asChild colorPalette="blue" size="sm">
              <Link to="/account/playlists">Manage playlists</Link>
            </Button>
          </section>

          <section>
            <Heading as="h2" mb={1} size="md">
              Profile information
            </Heading>
            <Text color="gray.500" fontSize="sm" mb={5}>
              Update your display name and avatar.
            </Text>
            <form
              className="space-y-5"
              onSubmit={(e) => {
                e.preventDefault();
                void profileForm.handleSubmit();
              }}
            >
              <profileForm.Field name="name">
                {(field) => (
                  <Field.Root>
                    <Field.Label>Display name</Field.Label>
                    <InputGroup startElement={<LuUser />}>
                      <Input
                        autoComplete="name"
                        className="h-12 w-full"
                        id={field.name}
                        name={field.name}
                        onBlur={field.handleBlur}
                        onChange={(e) => {
                          field.handleChange(e.target.value);
                        }}
                        placeholder="Enter your display name"
                        value={field.state.value}
                      />
                    </InputGroup>
                    <FieldInfo field={field} />
                  </Field.Root>
                )}
              </profileForm.Field>

              <profileForm.Field name="image">
                {(field) => (
                  <Field.Root>
                    <Field.Label>Profile picture URL</Field.Label>
                    <InputGroup startElement={<LuImage />}>
                      <Input
                        autoComplete="off"
                        className="h-12 w-full"
                        id={field.name}
                        name={field.name}
                        onBlur={field.handleBlur}
                        onChange={(e) => {
                          field.handleChange(e.target.value);
                        }}
                        placeholder="https://example.com/avatar.jpg"
                        type="url"
                        value={field.state.value}
                      />
                    </InputGroup>
                    {!field.state.meta.errors &&
                      field.state.value !== user.image && (
                        <div className="mt-3 flex items-center gap-3 rounded-lg bg-white p-4">
                          <Text color="gray.500" fontSize="sm">
                            Preview
                          </Text>
                          <AvatarGroup>
                            <Avatar.Root size="lg">
                              <Avatar.Fallback />
                              <Avatar.Image
                                src={field.state.value || undefined}
                              />
                            </Avatar.Root>
                          </AvatarGroup>
                        </div>
                      )}
                    <FieldInfo field={field} />
                  </Field.Root>
                )}
              </profileForm.Field>

              <profileForm.Subscribe
                selector={(state) => [state.canSubmit, state.isSubmitting]}
              >
                {([canSubmit, isSubmitting]) => (
                  <div className="flex justify-end pt-2">
                    <Button
                      disabled={!canSubmit}
                      loading={isSubmitting === true}
                      fontWeight="medium"
                      px={6}
                      type="submit"
                    >
                      {isSubmitting ? "Saving\u2026" : "Save changes"}
                    </Button>
                  </div>
                )}
              </profileForm.Subscribe>
            </form>
          </section>

          <section className="border-t border-gray-200 pt-12">
            <Heading as="h2" mb={1} size="md">
              Password
            </Heading>
            <Text color="gray.500" fontSize="sm" mb={5}>
              Choose a strong password you don&apos;t use elsewhere.
            </Text>
            <form
              className="space-y-5"
              onSubmit={(e) => {
                e.preventDefault();
                void passwordForm.handleSubmit();
              }}
            >
              <passwordForm.Field name="currentPassword">
                {(field) => (
                  <Field.Root>
                    <Field.Label>Current password</Field.Label>
                    <PasswordInput
                      autoComplete="current-password"
                      className="h-12 w-full"
                      id={field.name}
                      name={field.name}
                      onBlur={field.handleBlur}
                      onChange={(e) => {
                        field.handleChange(e.target.value);
                      }}
                      placeholder="Enter current password"
                      value={field.state.value}
                    />
                  </Field.Root>
                )}
              </passwordForm.Field>

              <passwordForm.Field name="newPassword">
                {(field) => (
                  <Field.Root>
                    <Field.Label>New password</Field.Label>
                    <PasswordInput
                      autoComplete="new-password"
                      className="h-12 w-full"
                      id={field.name}
                      name={field.name}
                      onBlur={field.handleBlur}
                      onChange={(e) => {
                        field.handleChange(e.target.value);
                      }}
                      placeholder="Enter new password"
                      value={field.state.value}
                    />
                  </Field.Root>
                )}
              </passwordForm.Field>

              <passwordForm.Subscribe
                selector={(state) => [state.canSubmit, state.isSubmitting]}
              >
                {([canSubmit, isSubmitting]) => (
                  <div className="flex justify-end pt-2">
                    <Button
                      disabled={!canSubmit}
                      loading={isSubmitting === true}
                      colorPalette="orange"
                      fontWeight="medium"
                      px={6}
                      type="submit"
                    >
                      {isSubmitting ? "Updating\u2026" : "Update password"}
                    </Button>
                  </div>
                )}
              </passwordForm.Subscribe>
            </form>
          </section>

          <PasskeysSection />

          <TwoFactorSection
            enabled={user.twoFactorEnabled}
            hasPassword={hasPassword}
          />

          <section className="border-t border-gray-200 pt-12">
            <Heading as="h2" mb={1} size="md">
              Danger zone
            </Heading>
            <Text
              className="dark:text-gray-400"
              color="gray.500"
              fontSize="sm"
              mb={4}
            >
              Deleting your account is permanent. Your posts and comments stay
              public under the name &ldquo;Deleted user&rdquo;.
            </Text>
            <div className="flex flex-col items-start justify-between gap-4 rounded-lg border border-red-100 bg-red-50 p-4 sm:flex-row sm:items-center dark:border-red-900 dark:bg-red-950/40">
              <Text className="dark:text-red-300" color="red.700" fontSize="sm">
                This removes your account and personal data for good. Public
                content is anonymized, not deleted.
              </Text>
              <DeleteAccountDialog
                hasPassword={hasPassword}
                isPending={deleteAccountMutation.isPending}
                onConfirm={(password) =>
                  deleteAccountMutation.mutate({ password })
                }
              />
            </div>
          </section>
        </div>
      </div>
    </Box>
  );
}
