import { Link } from "@tanstack/react-router";
import { HStack, Stack } from "src/components/ui/layout";
import { Avatar, Card } from "src/components/ui/media";
import { Text } from "src/components/ui/typography";

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
