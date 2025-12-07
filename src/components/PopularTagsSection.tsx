import { Badge, Heading, Stack, Text } from "@chakra-ui/react";
import { Link } from "@tanstack/react-router";

interface PopularTag {
  id: number;
  name: string;
  postCount: number;
}

interface PopularTagsSectionProps {
  tags: PopularTag[];
}

export function PopularTagsSection({ tags }: PopularTagsSectionProps) {
  return (
    <>
      <Heading size="sm" mb={3}>
        Popular Tags
      </Heading>
      {tags && tags.length > 0 ? (
        <Stack direction="row" flexWrap="wrap" gap={2}>
          {tags.map((tag) => (
            <Link
              key={tag.id}
              to="/posts/tags/$tag"
              params={{ tag: tag.name }}
            >
              <Badge
                px={2}
                py={1}
                borderRadius="full"
                cursor="pointer"
              >
                {tag.name} ({tag.postCount})
              </Badge>
            </Link>
          ))}
        </Stack>
      ) : (
        <Text fontSize="sm">No tags found</Text>
      )}
    </>
  );
}
