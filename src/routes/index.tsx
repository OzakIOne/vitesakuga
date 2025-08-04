import { createFileRoute } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { postsQueryOptions } from "../utils/posts";
import * as React from "react";
import { useForm } from "@tanstack/react-form";

export const Route = createFileRoute("/")({
  component: Home,
});

function Home() {
  const [searchTerm, setSearchTerm] = React.useState("");
  const { data: posts } = useSuspenseQuery(postsQueryOptions());

  const form = useForm({
    defaultValues: {
      search: "",
    },
    onSubmit: ({ value }) => {
      setSearchTerm(value.search);
    },
  });

  const filteredPosts = searchTerm
    ? posts.filter(
        (p) =>
          p.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
          p.content.toLowerCase().includes(searchTerm.toLowerCase())
      )
    : posts;

  return (
    <div className="p-4">
      <h2 className="text-2xl font-bold mb-4">Posts</h2>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void form.handleSubmit();
        }}
        className="mb-4 flex gap-2"
      >
        <form.Field
          name="search"
          children={(field) => (
            <input
              className="input flex-1"
              type="text"
              placeholder="Search..."
              value={field.state.value}
              onChange={(e) => field.handleChange(e.target.value)}
            />
          )}
        />
        <button type="submit" className="btn btn-primary">
          Search
        </button>
      </form>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredPosts.map((post) => (
          <div
            key={post.id}
            className="border rounded-lg p-4 shadow bg-white flex flex-col"
          >
            <h3 className="font-semibold text-lg mb-2">{post.title}</h3>
            <div className="text-gray-700 flex-1 mb-2">{post.content}</div>
            <div className="text-xs text-gray-500 mt-auto">
              {new Date(post.createdAt).toDateString()}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
