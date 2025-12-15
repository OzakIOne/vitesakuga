import { Spinner, Stack, Text } from "@chakra-ui/react";
import { useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { Suspense } from "react";
import { User } from "src/components/User";
import { usersQueryOptions } from "src/lib/users/users.queries";

export const Route = createFileRoute("/users/")({
  component: UsersLayoutComponent,
});

function UsersContent() {
  const usersQuery = useSuspenseQuery(usersQueryOptions());

  return (
    <div className="p-4 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
      {usersQuery.data.map((user) => (
        <User key={user.id} name={user.name} image={user.image} id={user.id} />
      ))}
    </div>
  );
}

function UsersLayoutComponent() {
  return (
    <Suspense
      fallback={
        <Stack align="center" justify="center" minH="400px">
          <Spinner size="lg" />
          <Text>Loading users...</Text>
        </Stack>
      }
    >
      <UsersContent />
    </Suspense>
  );
}
