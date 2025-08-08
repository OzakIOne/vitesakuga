import { Link } from "@tanstack/react-router";
import { PostsSelect } from "~/auth/db/schema";

export function PostList({ post }: { post }) {
  return (
    <div className="card bg-base-100 w-48 shadow-sm m-2">
      {/* TODO image */}
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
            params={{ postId: String(post.id) }}
            className="btn btn-primary btn-xs"
          >
            View post
          </Link>
        </div>
      </div>
    </div>
  );
}
