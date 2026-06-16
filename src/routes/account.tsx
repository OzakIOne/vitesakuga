import {
  Avatar,
  AvatarGroup,
  Box,
  Button,
  CloseButton,
  Dialog,
  Field,
  Heading,
  Input,
  InputGroup,
  Portal,
  Text,
} from "@chakra-ui/react";
import { useForm } from "@tanstack/react-form";
import { createFileRoute, redirect } from "@tanstack/react-router";
import { LuImage, LuUser } from "react-icons/lu";
import { FieldInfo } from "src/components/form/FieldInfo";
import { PasswordInput } from "src/components/ui/password-input";
import {
  useChangePassword,
  useDeleteAccount,
  useUpdateProfile,
} from "src/lib/auth/auth.hooks";
import { passwordSchema, profileSchema } from "src/lib/auth/auth.schemas";

export const Route = createFileRoute("/account")({
  beforeLoad: ({ context, location }) => {
    if (!context.user) {
      throw redirect({
        search: { redirect: location.pathname },
        to: "/login",
      });
    }
    return { user: context.user };
  },
  component: RouteComponent,
});

function RouteComponent() {
  const { user } = Route.useRouteContext();
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
      onChange: profileSchema,
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
      onChange: passwordSchema,
    },
  });

  const memberSince = new Intl.DateTimeFormat("en-US", {
    month: "long",
    year: "numeric",
    day: "numeric",
  }).format(new Date(user.createdAt));

  return (
    <Box className="flex min-h-dvh flex-col items-center px-4 py-16 sm:px-8">
      <div className="w-full max-w-lg space-y-12 rounded-2xl px-8 py-12 sm:px-12 sm:py-14">
        <div className="flex items-center gap-5">
          <AvatarGroup>
            <Avatar.Root size="2xl">
              <Avatar.Fallback />
              <Avatar.Image className="rounded-full" src={user.image ?? ""} />
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
                        className="h-12 w-full"
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
                        className="h-12 w-full"
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
                              <Avatar.Image src={field.state.value} />
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
                      loading={isSubmitting}
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
                      loading={isSubmitting}
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

          <section className="border-t border-gray-200 pt-12">
            <Heading as="h2" mb={1} size="md">
              Danger zone
            </Heading>
            <Text color="gray.500" fontSize="sm" mb={4}>
              Deleting your account is permanent.
            </Text>
            <div className="flex flex-col items-start justify-between gap-4 rounded-lg border border-red-100 bg-red-50 p-4 sm:flex-row sm:items-center">
              <Text color="red.700" fontSize="sm">
                This removes your account and all associated data for good.
              </Text>
              <Dialog.Root role="alertdialog">
                <Dialog.Trigger asChild>
                  <Button
                    colorPalette="red"
                    flexShrink={0}
                    size="sm"
                    variant="outline"
                  >
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
                        <Text>
                          This action cannot be undone and all your data will be
                          permanently removed.
                        </Text>
                      </Dialog.Body>
                      <Dialog.Footer>
                        <Dialog.ActionTrigger asChild>
                          <Button variant="outline">Cancel</Button>
                        </Dialog.ActionTrigger>
                        <Button
                          colorPalette="red"
                          onClick={() => deleteAccountMutation.mutate()}
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
            </div>
          </section>
        </div>
      </div>
    </Box>
  );
}
