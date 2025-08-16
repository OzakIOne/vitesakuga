import { Heading, Text } from "@chakra-ui/react";
import { Video } from "./Video";
import { User } from "./User";
import { DbSchemaSelect } from "~/auth/db/schema";

export function Post({
  post,
  user,
}: {
  post: DbSchemaSelect["posts"];
  user: DbSchemaSelect["user"];
}) {
  return (
    <>
      <div className="w-lg">
        <Video url={post.key} />
      </div>
      <Heading as="h3">{post.title}</Heading>
      <Text> {post.content}</Text>
      <User user={user} />
    </>
  );
}
