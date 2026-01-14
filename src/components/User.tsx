import { Avatar, Card, HStack, Stack, Text } from "@chakra-ui/react";
import { Link } from "@tanstack/react-router";

export function User({
  name,
  image,
  id,
}: {
  name: string;
  image?: string | null;
  id: string;
}) {
  return (
    <Link params={{ id }} to="/users/$id">
      <Card.Root size="sm">
        <Card.Body>
          <HStack>
            <Avatar.Root>
              {image && <Avatar.Image src={image} />}
              <Avatar.Fallback name={name} />
            </Avatar.Root>
            <Stack>
              <Text fontWeight="semibold" textStyle="sm">
                {name}
              </Text>
            </Stack>
          </HStack>
        </Card.Body>
      </Card.Root>
    </Link>
  );
}
