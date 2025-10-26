import {
  Avatar,
  AvatarGroup,
  Box,
  Button,
  Center,
  Field,
  Heading,
  Input,
  InputGroup,
  Text,
} from "@chakra-ui/react";
import { useForm } from "@tanstack/react-form";
import { createFileRoute, useRouter } from "@tanstack/react-router";
import * as React from "react";
import { LuImage, LuUser } from "react-icons/lu";
import { FieldInfo } from "src/components/FieldInfo";
import { PasswordInput } from "src/components/ui/password-input";
import {
  type AuthenticatedContext,
  authMiddleware,
} from "src/lib/auth/auth.middleware";
import authClient from "src/lib/auth/client";
import z from "zod";

export const Route = createFileRoute("/account")({
  server: {
    middleware: [authMiddleware],
  },
  component: RouteComponent,
});

const profileSchema = z.object({
  name: z.string(),
  image: z.url(),
});

function RouteComponent() {
  const { user } = Route.useRouteContext() as AuthenticatedContext;
  const [serverError, setServerError] = React.useState<string | null>(null);
  const router = useRouter();

  const profileForm = useForm({
    defaultValues: {
      name: user.name,
      image: user.image,
    },
    validators: {
      onChange: profileSchema,
    },
    onSubmit: async ({ value }) => {
      setServerError(null);
      try {
        const test = await authClient.updateUser(value);
        // await queryClient.invalidateQueries({ queryKey: ["user"] }); // useless ??
        await router.invalidate();
        console.log({ test });
      } catch (err) {
        if (err instanceof Error) {
          setServerError(err.message);
        } else {
          setServerError("Failed to update profile");
        }
      }
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
          newPassword: value.newPassword,
          currentPassword: value.currentPassword,
          revokeOtherSessions: true,
        });
        formApi.reset();
      } catch (err) {
        if (err instanceof Error) {
          setServerError(err.message);
        } else {
          setServerError("Failed to change password");
        }
      }
    },
  });

  // TODO add confirmation
  const handleDeleteUser = async () => {
    setServerError(null);
    try {
      await authClient.deleteUser();
    } catch (err) {
      if (err instanceof Error) {
        setServerError(err.message);
      } else {
        setServerError("Failed to delete account");
      }
    }
  };

  return (
    <Box className="h-screen  flex flex-col items-center justify-center p-6">
      <div className="w-full max-w-lg  rounded-xl shadow-lg border p-10 space-y-10">
        <div className="p-6 mb-8">
          <div className="flex items-center gap-6">
            <AvatarGroup>
              <Avatar.Root size="2xl">
                <Avatar.Fallback />
                <Avatar.Image src={user.image || ""} className="rounded-full" />
              </Avatar.Root>
            </AvatarGroup>
            <div className="flex-1 min-w-0">
              <Heading size="lg">{user.name}</Heading>
              <Text>{user.email}</Text>
              <Text>
                Member since: {new Date(user.createdAt).toLocaleDateString()}
              </Text>
            </div>
          </div>
        </div>

        {serverError && (
          <div className="bg-red-50 border border-red-200 px-6 py-4 rounded-lg mb-8">
            <Text fontWeight="medium" mb={1}>
              Error
            </Text>
            <Text>{serverError}</Text>
          </div>
        )}

        <div className="space-y-8">
          <div>
            <Heading size="lg" className="mb-2">
              Profile Information
            </Heading>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                profileForm.handleSubmit();
              }}
              className="space-y-4"
            >
              <profileForm.Field name="name">
                {(field) => (
                  <div className="mb-6">
                    <Field.Root>
                      <Field.Label>Display Name</Field.Label>
                      <InputGroup startElement={<LuUser />}>
                        <Input
                          value={field.state.value}
                          onChange={(e) => field.handleChange(e.target.value)}
                          placeholder="Enter your display name"
                          className="w-full h-12"
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
                          type="url"
                          value={field.state.value}
                          onChange={(e) => field.handleChange(e.target.value)}
                          placeholder="https://example.com/avatar.jpg"
                          className="w-full h-12"
                        />
                      </InputGroup>
                    </Field.Root>
                    {!field.state.meta.errors &&
                      field.state.value !== user?.image && (
                        <div className="mt-4 p-4 bg-gray-50 rounded-lg">
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
                    <Button
                      type="submit"
                      marginTop="4"
                      disabled={isSubmitting}
                      fontWeight="medium"
                    >
                      {isSubmitting ? "Saving..." : "Save Profile Changes"}
                    </Button>
                  </Center>
                )}
              </profileForm.Subscribe>
            </form>
          </div>

          <div className="pt-10 border-t">
            <form
              onSubmit={(e) => {
                e.preventDefault();
                passwordForm.handleSubmit();
              }}
              className="space-y-4"
            >
              <passwordForm.Field name="currentPassword">
                {(field) => (
                  <Field.Root>
                    <Field.Label>Current Password</Field.Label>
                    <PasswordInput
                      type="password"
                      value={field.state.value}
                      onChange={(e) => field.handleChange(e.target.value)}
                      placeholder="Enter current password"
                      className="w-full h-12"
                    />
                  </Field.Root>
                )}
              </passwordForm.Field>

              <passwordForm.Field name="newPassword">
                {(field) => (
                  <Field.Root>
                    <Field.Label>New Password</Field.Label>
                    <PasswordInput
                      type="password"
                      value={field.state.value}
                      onChange={(e) => field.handleChange(e.target.value)}
                      placeholder="Enter new password"
                      className="w-full h-12"
                    />
                  </Field.Root>
                )}
              </passwordForm.Field>

              <Center>
                <Button
                  type="submit"
                  colorPalette="orange"
                  fontWeight="medium"
                  margin="4"
                >
                  Update Password
                </Button>
              </Center>
            </form>
          </div>
          <Center>
            <Button
              onClick={handleDeleteUser}
              colorPalette="red"
              fontWeight="medium"
            >
              Delete Account
            </Button>
          </Center>
        </div>
      </div>
    </Box>
  );
}
