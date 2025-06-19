import { Link, Outlet, createFileRoute } from "@tanstack/react-router";
import { usersQueryOptions } from "../utils/users";
import { DatabaseSchema } from "~/db/schema";
import {
  useQueryClient,
  useMutation,
  useSuspenseQuery,
} from "@tanstack/react-query";
import { useForm } from "@tanstack/react-form";
import { z } from "zod";
import { userCreateSchema } from "../utils/userSchemas";
import React from "react";

export const Route = createFileRoute("/users")({
  loader: async ({ context }) =>
    await context.queryClient.ensureQueryData(usersQueryOptions()),

  component: UsersLayoutComponent,
});

async function createUser(data: DatabaseSchema["users"]) {
  const response = await fetch("/api/users", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(data),
  });

  if (!response.ok) {
    throw new Error("Failed to create user");
  }

  return response.json();
}

function UsersLayoutComponent() {
  const usersQuery = useSuspenseQuery(usersQueryOptions());
  const queryClient = useQueryClient();
  const [status, setStatus] = React.useState<null | {
    type: "success" | "error";
    message: string;
  }>(null);

  const mutation = useMutation({
    mutationFn: createUser,
    onSuccess: () => {
      setStatus({ type: "success", message: "User created successfully!" });
      queryClient.invalidateQueries({ queryKey: ["users"] });
      form.reset();
    },
    onError: () => {
      setStatus({ type: "error", message: "Failed to create user." });
    },
  });

  const form = useForm({
    defaultValues: {
      username: "",
      email: "",
    },
    onSubmit: async ({ value }) => {
      setStatus(null);
      mutation.mutate(value);
    },
    validators: {
      onChange: userCreateSchema,
    },
  });

  return (
    <div className="p-2 flex gap-2">
      <ul className="list-disc pl-4">
        {[...usersQuery.data].map((user) => {
          return (
            <li key={user.id} className="whitespace-nowrap">
              <Link
                to="/users/$userId"
                params={{
                  userId: String(user.id),
                }}
                className="block py-1 text-blue-800 hover:text-blue-600"
                activeProps={{ className: "text-black font-bold" }}
              >
                <div>{user.username}</div>
              </Link>
            </li>
          );
        })}
      </ul>
      <hr />
      <p>Create user</p>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          form.handleSubmit();
        }}
        className="flex flex-col gap-2"
      >
        <form.Field name="username">
          {(field) => (
            <>
              <input
                className="input"
                name={field.name}
                value={field.state.value}
                onChange={(e) => field.handleChange(e.target.value)}
                onBlur={field.handleBlur}
                required
                placeholder="Username"
              />
              {field.state.meta.errors.length > 0 && (
                <em className="text-red-600">
                  {field.state.meta.errors
                    .map((e) =>
                      typeof e === "string" ? e : e?.message || String(e)
                    )
                    .join(", ")}
                </em>
              )}
            </>
          )}
        </form.Field>
        <form.Field name="email">
          {(field) => (
            <>
              <input
                className="input"
                name={field.name}
                value={field.state.value}
                onChange={(e) => field.handleChange(e.target.value)}
                onBlur={field.handleBlur}
                required
                placeholder="email@gmail.com"
              />
              {field.state.meta.errors.length > 0 && (
                <em className="text-red-600">
                  {field.state.meta.errors
                    .map((e) =>
                      typeof e === "string" ? e : e?.message || String(e)
                    )
                    .join(", ")}
                </em>
              )}
            </>
          )}
        </form.Field>
        <form.Subscribe
          selector={(state) => [state.canSubmit, state.isSubmitting]}
          children={([canSubmit, isSubmitting]) => (
            <button
              className="btn"
              type="submit"
              disabled={!canSubmit || isSubmitting}
            >
              {isSubmitting ? "..." : "Submit"}
            </button>
          )}
        />
      </form>
      {status && (
        <div
          className={
            status.type === "success" ? "text-green-600" : "text-red-600"
          }
        >
          {status.message}
        </div>
      )}
      <Outlet />
    </div>
  );
}
