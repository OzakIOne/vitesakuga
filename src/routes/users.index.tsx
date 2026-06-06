import "src/lib/polyfills"

import { Spinner, Stack, Text } from "@chakra-ui/react"
import { useLiveSuspenseQuery } from "@tanstack/react-db"
import { createFileRoute } from "@tanstack/react-router"
import { Suspense } from "react"
import { User } from "src/components/User"
import { usersCollection } from "src/lib/db/collections"

export const Route = createFileRoute("/users/")({
  component: UsersLayoutComponent,
})

function UsersContent() {
  const { data: users } = useLiveSuspenseQuery((q) =>
    q.from({ u: usersCollection }).orderBy(({ u }) => u.name, "asc"),
  )

  return (
    <div className="grid grid-cols-1 gap-4 p-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
      {users.map((user) => (
        <User
          id={user.id}
          image={user.image}
          key={user.id}
          name={user.name}
        />
      ))}
    </div>
  )
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
  )
}
