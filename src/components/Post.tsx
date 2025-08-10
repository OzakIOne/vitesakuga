import { Video } from "./Video";

export function Post({ post, user }: { post: any; user: any }) {
  return (
    <div>
      <div className="w-lg">
        <Video url={post.key} />
      </div>
      <h4 className="text-xl font-bold underline">Post title: {post.title}</h4>
      <div className="text-sm">Post content: {post.content}</div>
      <div>Posted by: {user.name}</div>
    </div>
  );
}
