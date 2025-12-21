import {
  Avatar,
  AvatarGroup,
  Box,
  Button,
  Center,
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
import { createFileRoute, useNavigate, useRouter } from "@tanstack/react-router";
import * as React from "react";
import { LuImage, LuUser } from "react-icons/lu";
import { FieldInfo } from "src/components/form/FieldInfo";
import { PasswordInput } from "src/components/ui/password-input";
import { toaster } from "src/components/ui/toaster";
import { type MiddlewareUser, authMiddleware } from "src/lib/auth/auth.middleware";
import authClient from "src/lib/auth/client";
import z from "zod";

export const Route = createFileRoute("/account")({
  component: RouteComponent,
  server: {
    middleware: [authMiddleware],
  },
});

const profileSchema = z.object({
  image: z.url().or(z.literal("")),
  name: z.string(),
});

function RouteComponent() {
  const { user } = Route.useRouteContext() as MiddlewareUser;
  console.log("user:", user);

  const [serverError, setServerError] = React.useState<string | null>(null);
  const router = useRouter();

  const navigate = useNavigate();

  const profileForm = useForm({
    defaultValues: {
      image: user.image,
      name: user.name,
    },
    onSubmit: async ({ value }) => {
      setServerError(null);
      try {
        await authClient.updateUser(value);
        await router.invalidate();
        toaster.create({
          closable: true,
          description: "Your profile has been successfully updated.",
          duration: 3000,
          title: "Profile updated",
          type: "success",
        });
      } catch (err) {
        toaster.create({
          closable: true,
          description: err,
          duration: 5000,
          title: "Error updating profile",
          type: "error",
        });
      }
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
      setServerError(null);
      try {
        await authClient.changePassword({
          currentPassword: value.currentPassword,
          newPassword: value.newPassword,
          revokeOtherSessions: true,
        });
        formApi.reset();
        toaster.create({
          closable: true,
          description: "Your password has been successfully changed.",
          duration: 3000,
          title: "Password updated",
          type: "success",
        });
      } catch (err) {
        toaster.create({
          closable: true,
          description: err,
          duration: 5000,
          title: "Error changing password",
          type: "error",
        });
      }
    },
  });

  const handleDeleteUser = async () => {
    try {
      await authClient.deleteUser();
      toaster.create({
        closable: true,
        description: "Your account has been successfully deleted.",
        duration: 3000,
        title: "Account deleted",
        type: "success",
      });
      navigate({ to: "/" });
    } catch (err) {
      toaster.create({
        closable: true,
        description: err,
        duration: 5000,
        title: "Error deleting account",
        type: "error",
      });
    }
  };

  return (
    <Box className="flex h-screen flex-col items-center justify-center p-6">
      <div className="w-full max-w-lg space-y-10 rounded-xl border p-10 shadow-lg">
        <div className="mb-8 p-6">
          <div className="flex items-center gap-6">
            <AvatarGroup>
              <Avatar.Root size="2xl">
                <Avatar.Fallback />
                <Avatar.Image className="rounded-full" src={user.image || ""} />
              </Avatar.Root>
            </AvatarGroup>
            <div className="min-w-0 flex-1">
              <Heading size="lg">{user.name}</Heading>
              <Text>{user.email}</Text>
              <Text>Member since: {new Date(user.createdAt).toLocaleDateString()}</Text>
            </div>
          </div>
        </div>

        {serverError && (
          <div className="mb-8 rounded-lg border border-red-200 bg-red-50 px-6 py-4">
            <Text fontWeight="medium" mb={1}>
              Error
            </Text>
            <Text>{serverError}</Text>
          </div>
        )}

        <div className="space-y-8">
          <div>
            <Heading className="mb-2" size="lg">
              Profile Information
            </Heading>
            <form
              className="space-y-4"
              onSubmit={(e) => {
                e.preventDefault();
                profileForm.handleSubmit();
              }}
            >
              <profileForm.Field name="name">
                {(field) => (
                  <div className="mb-6">
                    <Field.Root>
                      <Field.Label>Display Name</Field.Label>
                      <InputGroup startElement={<LuUser />}>
                        <Input
                          className="h-12 w-full"
                          onChange={(e) => field.handleChange(e.target.value)}
                          placeholder="Enter your display name"
                          value={field.state.value}
                        />
                      </InputGroup>
                    </Field.Root>
                  </div>
                )}
              </profileForm.Field>

              <profileForm.Field name="image">
                {(field) => (
                  <div className="mb-8">
                    <Field.Root>
                      <Field.Label>Profile Picture URL</Field.Label>
                      <InputGroup startElement={<LuImage />}>
                        <Input
                          className="h-12 w-full"
                          onChange={(e) => field.handleChange(e.target.value)}
                          placeholder="https://example.com/avatar.jpg"
                          type="url"
                          value={field.state.value}
                        />
                      </InputGroup>
                    </Field.Root>
                    {!field.state.meta.errors && field.state.value !== user?.image && (
                      <div className="mt-4 rounded-lg bg-gray-50 p-4">
                        <Text fontWeight="medium" mb={3}>
                          Preview:
                        </Text>
                        <AvatarGroup>
                          <Avatar.Root size="2xl">
                            <Avatar.Fallback />
                            <Avatar.Image src={field.state.value} />
                          </Avatar.Root>
                        </AvatarGroup>
                      </div>
                    )}
                    <FieldInfo field={field} />
                  </div>
                )}
              </profileForm.Field>

              <profileForm.Subscribe selector={(state) => [state.isSubmitting]}>
                {([isSubmitting]) => (
                  <Center>
                    <Button disabled={isSubmitting} fontWeight="medium" marginTop="4" type="submit">
                      {isSubmitting ? "Saving..." : "Save Profile Changes"}
                    </Button>
                  </Center>
                )}
              </profileForm.Subscribe>
            </form>
          </div>

          <div className="border-t pt-10">
            <form
              className="space-y-4"
              onSubmit={(e) => {
                e.preventDefault();
                passwordForm.handleSubmit();
              }}
            >
              <passwordForm.Field name="currentPassword">
                {(field) => (
                  <Field.Root>
                    <Field.Label>Current Password</Field.Label>
                    <PasswordInput
                      className="h-12 w-full"
                      onChange={(e) => field.handleChange(e.target.value)}
                      placeholder="Enter current password"
                      type="password"
                      value={field.state.value}
                    />
                  </Field.Root>
                )}
              </passwordForm.Field>

              <passwordForm.Field name="newPassword">
                {(field) => (
                  <Field.Root>
                    <Field.Label>New Password</Field.Label>
                    <PasswordInput
                      className="h-12 w-full"
                      onChange={(e) => field.handleChange(e.target.value)}
                      placeholder="Enter new password"
                      type="password"
                      value={field.state.value}
                    />
                  </Field.Root>
                )}
              </passwordForm.Field>

              <Center>
                <Button colorPalette="orange" fontWeight="medium" margin="4" type="submit">
                  Update Password
                </Button>
              </Center>
            </form>
          </div>

          <Dialog.Root role="alertdialog">
            <Center>
              <Dialog.Trigger asChild>
                <Button colorPalette="red">Delete Account</Button>
              </Dialog.Trigger>
            </Center>
            <Portal>
              <Dialog.Backdrop />
              <Dialog.Positioner>
                <Dialog.Content>
                  <Dialog.Header>
                    <Dialog.Title>Are you sure?</Dialog.Title>
                  </Dialog.Header>
                  <Dialog.Body>
                    <p>
                      This action cannot be undone and all your data will be permanently removed.
                    </p>
                  </Dialog.Body>
                  <Dialog.Footer>
                    <Dialog.ActionTrigger asChild>
                      <Button variant="outline">Cancel</Button>
                    </Dialog.ActionTrigger>
                    <Button colorPalette="red" onClick={handleDeleteUser}>
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
      </div>
    </Box>
  );
}
