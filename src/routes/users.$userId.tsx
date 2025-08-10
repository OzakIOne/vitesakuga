import { createFileRoute } from "@tanstack/react-router";
import { fetchUser } from "~/utils/users";
import { NotFound } from "~/components/NotFound";
import { UserErrorComponent } from "~/components/UserError";
import { PostList } from "~/components/PostList";

export const Route = createFileRoute("/users/$userId")({
  loader: async ({ params: { userId } }) =>
    fetchUser({
      data: userId,
    }),
  errorComponent: UserErrorComponent,
  component: UserComponent,
  notFoundComponent: () => {
    return <NotFound>User not found</NotFound>;
  },
});

function UserComponent() {
  const data = Route.useLoaderData();
  console.log("user", data);
  return (
    <>
      <div className="flex flex-col">
        <span>Name: {data.user.name}</span>
        <span>
          Member since: {new Date(data.user.createdAt).toDateString()}
        </span>
      </div>
      <div className="flex">
        {data.posts.map((post) => (
          <PostList key={post.id} post={post} />
        ))}
      </div>
    </>
  );
}
