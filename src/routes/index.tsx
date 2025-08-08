import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { fetchPosts } from "../utils/posts";
import * as React from "react";
import { useForm } from "@tanstack/react-form";
import { useDebouncer } from "@tanstack/react-pacer/debouncer";

export const Route = createFileRoute("/")({
  component: Home,
});

function Home() {
  const navigate = useNavigate();

  const form = useForm({
    defaultValues: {
      search: "",
    },
    onSubmit: ({ value }) => {
      const val = value.search.trim();
      if (!val) return;
      navigate({
        to: "/posts",
        search: { q: val },
      });
    },
  });

  const setDebouncedQuery = useDebouncer(
    (value: string) => {
      if (!value.trim()) return;
      navigate({
        to: "/posts",
        search: { q: value },
      });
    },
    {
      wait: 500,
      enabled: () => form.state.values.search.length > 2,
    }
  );

  return (
    <div className="p-4">
      <h2 className="text-2xl font-bold mb-4">Posts</h2>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          setDebouncedQuery.flush();
          form.handleSubmit();
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
              onChange={(e) => {
                const val = e.target.value;
                field.handleChange(val);
                setDebouncedQuery.maybeExecute(val);
              }}
            />
          )}
        />
        <button type="submit" className="btn btn-primary">
          Search
        </button>
      </form>
    </div>
  );
}
