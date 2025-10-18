import { Heading, Text } from "@chakra-ui/react";
import { Video } from "./Video";
import { User } from "./User";
import { DbSchemaSelect } from "~/auth/db/schema";

export function Post({
  post,
  user,
}: {
  post: Partial<DbSchemaSelect["posts"]>;
  user: Partial<DbSchemaSelect["user"]>;
}) {
  return (
    <>
      {post.key && (
        <div className="w-lg">
          <Video url={post.key} />
        </div>
      )}
      {post.title && <Heading as="h3">{post.title}</Heading>}
      {post.content && <Text>{post.content}</Text>}
      {user?.id && user.name && (
        <User
          user={{
            id: user.id,
            name: user.name,
            image: user.image,
          }}
        />
      )}
    </>
  );
}
