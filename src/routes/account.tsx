import * as React from "react";
import { createFileRoute, redirect, useRouter } from "@tanstack/react-router";
import { useForm } from "@tanstack/react-form";
import authClient from "~/auth/client";
import {
  Avatar,
  AvatarGroup,
  Button,
  Heading,
  Input,
  InputGroup,
  Text,
  Center,
  Box,
} from "@chakra-ui/react";
import { LuImage, LuUser } from "react-icons/lu";
import z from "zod";
import { PasswordInput } from "~/components/ui/password-input";
import { User } from "~/components/User";
import { FieldInfo } from "~/components/FieldInfo";

export const Route = createFileRoute("/account")({
  beforeLoad: async ({ context }) => {
    if (!context.user) throw redirect({ to: "/login" });
  },
  component: RouteComponent,
});

const profileSchema = z.object({
  name: z.string(),
  image: z.url(),
});

function RouteComponent() {
  const { user } = Route.useRouteContext();
  const [serverError, setServerError] = React.useState<string | null>(null);
  const router = useRouter();

  const profileForm = useForm({
    defaultValues: {
      name: user?.name || "",
      image: user?.image || "",
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
      } catch (err: any) {
        setServerError(err?.message || "Failed to update profile");
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
      } catch (err: any) {
        setServerError(err?.message || "Failed to change password");
      }
    },
  });

  // TODO add confirmation
  const handleDeleteUser = async () => {
    setServerError(null);
    try {
      await authClient.deleteUser();
    } catch (err: any) {
      setServerError(err?.message || "Failed to delete account");
    }
  };

  return (
    <Box className="min-h-screen  flex flex-col items-center justify-center p-6">
      <div className="w-full max-w-lg  rounded-xl shadow-lg border p-10 space-y-10">
        <div className="p-6 mb-8">
          <div className="flex items-center gap-6">
            <AvatarGroup>
              <Avatar.Root size="2xl">
                <Avatar.Fallback />
                <Avatar.Image src={user!.image!} className="rounded-full" />
              </Avatar.Root>
            </AvatarGroup>
            <div className="flex-1 min-w-0">
              <Heading size="lg">{user!.name}</Heading>
              <Text size="sm">{user!.email}</Text>
              <Text size="sm">
                Member since: {new Date(user!.createdAt).toLocaleDateString()}
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
            <div className="mb-6">
              <Heading size="lg" className="mb-2">
                Profile Information
              </Heading>
            </div>
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
                    <Text fontWeight="medium" mb={3}>
                      Display Name
                    </Text>
                    <InputGroup startElement={<LuUser />}>
                      <Input
                        value={field.state.value}
                        onChange={(e) => field.handleChange(e.target.value)}
                        placeholder="Enter your display name"
                        className="w-full h-12"
                      />
                    </InputGroup>
                  </div>
                )}
              </profileForm.Field>

              <profileForm.Field name="image">
                {(field) => (
                  <div className="mb-8">
                    <Text fontWeight="medium" mb={3}>
                      Profile Picture URL
                    </Text>
                    <InputGroup startElement={<LuImage />}>
                      <Input
                        type="url"
                        value={field.state.value}
                        onChange={(e) => field.handleChange(e.target.value)}
                        placeholder="https://example.com/avatar.jpg"
                        className="w-full h-12"
                      />
                    </InputGroup>
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

          {/* Security Section */}
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
                  <div className="mb-6">
                    <Text fontWeight="medium" mb={3}>
                      Current Password
                    </Text>
                    <PasswordInput
                      type="password"
                      value={field.state.value}
                      onChange={(e) => field.handleChange(e.target.value)}
                      placeholder="Enter current password"
                      className="w-full h-12"
                    />
                  </div>
                )}
              </passwordForm.Field>

              <passwordForm.Field name="newPassword">
                {(field) => (
                  <div className="mb-8">
                    <Text fontWeight="medium" mb={3}>
                      New Password
                    </Text>
                    <PasswordInput
                      type="password"
                      value={field.state.value}
                      onChange={(e) => field.handleChange(e.target.value)}
                      placeholder="Enter new password"
                      className="w-full h-12"
                    />
                  </div>
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
