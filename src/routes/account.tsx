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
} from "@chakra-ui/react";
import { LuImage, LuUser } from "react-icons/lu";
import z from "zod";
import { PasswordInput } from "~/components/ui/password-input";
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
    <div className="p-4 max-w-lg mx-auto space-y-6">
      <div className="flex items-center gap-4 border-b pb-4">
        <AvatarGroup>
          <Avatar.Root>
            <Avatar.Fallback />
            <Avatar.Image src={user!.image} />
          </Avatar.Root>
        </AvatarGroup>
        <div>
          <Heading>{user!.name}</Heading>
          <Text>{user!.email}</Text>
          <Text>
            Member since: {new Date(user!.createdAt).toLocaleDateString()}
          </Text>
        </div>
      </div>

      {/* Error Message */}
      {serverError && (
        <div className="alert alert-error">
          <span>{serverError}</span>
        </div>
      )}

      <form
        onSubmit={(e) => {
          e.preventDefault();
          profileForm.handleSubmit();
        }}
        className="space-y-4"
      >
        <profileForm.Field name="name">
          {(field) => (
            <InputGroup startElement={<LuUser />}>
              <Input
                value={field.state.value}
                onChange={(e) => field.handleChange(e.target.value)}
                placeholder="Username"
              />
            </InputGroup>
          )}
        </profileForm.Field>

        <profileForm.Field name="image">
          {(field) => (
            <>
              <InputGroup startElement={<LuImage />}>
                <Input
                  type="url"
                  value={field.state.value}
                  onChange={(e) => field.handleChange(e.target.value)}
                  placeholder="https://example.com/avatar.jpg"
                />
              </InputGroup>
              {!field.state.meta.errors &&
                field.state.value !== user?.image && (
                  <AvatarGroup>
                    <Avatar.Root>
                      <Avatar.Fallback />
                      <Avatar.Image src={field.state.value} />
                    </Avatar.Root>
                  </AvatarGroup>
                )}
              <FieldInfo field={field} />
            </>
          )}
        </profileForm.Field>

        <profileForm.Subscribe selector={(state) => [state.isSubmitting]}>
          {([isSubmitting]) => (
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? "Saving..." : "Save Changes"}
            </Button>
          )}
        </profileForm.Subscribe>
      </form>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          passwordForm.handleSubmit();
        }}
        className="space-y-4"
      >
        <passwordForm.Field name="currentPassword">
          {(field) => (
            <>
              <Text>Current password</Text>
              <PasswordInput
                type="password"
                className="input input-bordered w-full"
                value={field.state.value}
                onChange={(e) => field.handleChange(e.target.value)}
              />
            </>
          )}
        </passwordForm.Field>

        <passwordForm.Field name="newPassword">
          {(field) => (
            <>
              <Text>New password</Text>
              <PasswordInput
                type="password"
                className="input input-bordered w-full"
                value={field.state.value}
                onChange={(e) => field.handleChange(e.target.value)}
              />
            </>
          )}
        </passwordForm.Field>

        <Button type="submit" colorPalette={"orange"}>
          Change Password
        </Button>
      </form>

      {/* Delete Account */}
      <Button onClick={handleDeleteUser} colorPalette={"red"}>
        Delete Account
      </Button>
    </div>
  );
}
