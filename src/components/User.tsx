import { Card, HStack, Avatar, Stack, Text } from "@chakra-ui/react";
import { Link } from "@tanstack/react-router";
import { DbSchemaInsert } from "~/auth/db/schema";

export function User({ user }: { user: DbSchemaInsert["user"] }) {
  return (
    <Link key={user.id} to="/users/$userId" params={{ userId: user.id }}>
      <Card.Root size="sm">
        <Card.Body>
          <HStack>
            <Avatar.Root>
              {user.image && <Avatar.Image src={user.image} />}
              <Avatar.Fallback name={user.name} />
            </Avatar.Root>
            <Stack>
              <Text fontWeight="semibold" textStyle="sm">
                {user.name}
              </Text>
            </Stack>
          </HStack>
        </Card.Body>
      </Card.Root>
    </Link>
  );
}
