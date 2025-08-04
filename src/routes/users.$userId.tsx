import { createFileRoute, Link } from "@tanstack/react-router";
import { userIdQueryOptions } from "~/utils/users";
import { NotFound } from "~/components/NotFound";
import { UserErrorComponent } from "~/components/UserError";

export const Route = createFileRoute("/users/$userId")({
  loader: async ({ context, params: { userId } }) => {
    await context.queryClient.ensureQueryData(userIdQueryOptions(userId));
  },
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
        <span>email: {data.user.email}</span>
      </div>
      <div className="flex">
        {data.posts.map((post) => (
          <div className="card bg-base-100 w-48 shadow-sm m-2">
            {/* TODO video */}
            {/* <figure>
              <img
                src="https://img.daisyui.com/images/stock/photo-1606107557195-0e29a4b5b4aa.webp"
                alt="Shoes"
              />
            </figure> */}
            <div className="card-body">
              <h2 className="card-title">{post.title}</h2>
              <p>{post.content}</p>
              {/* TODO post tags */}
              {/* <div className="card-actions justify-end">
                <div className="badge badge-outline">Fashion</div>
                <div className="badge badge-outline">Products</div>
              </div> */}
              <div className="card-actions">
                <Link
                  to="/posts/$postId"
                  params={{ postId: post.id }}
                  className="btn btn-primary btn-xs"
                >
                  View post
                </Link>
              </div>
            </div>
          </div>
        ))}
      </div>
    </>
  );
}
