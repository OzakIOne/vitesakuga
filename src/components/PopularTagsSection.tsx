import { Link } from "@tanstack/react-router";
import { Badge } from "src/components/ui/feedback";
import { Stack } from "src/components/ui/layout";
import { Heading, Text } from "src/components/ui/typography";

export type PopularTag = {
  id: number;
  name: string;
  postCount: number;
};

type PopularTagsSectionProps = {
  tags: PopularTag[];
};

export function PopularTagsSection({ tags }: PopularTagsSectionProps) {
  return (
    <>
      <Heading mb={3} size="sm">
        Popular Tags
      </Heading>
      {tags && tags.length > 0 ? (
        <Stack direction="row" flexWrap="wrap" gap={2}>
          {tags.map((tag) => (
            <Link key={tag.id} params={{ tag: tag.name }} to="/posts/tags/$tag">
              <Badge borderRadius="full" cursor="pointer" px={2} py={1}>
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
