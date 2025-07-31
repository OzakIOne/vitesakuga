import { notFound } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { queryOptions } from "@tanstack/react-query";

export type PostType = {
  id: string;
  title: string;
  body: string;
};

export const DEPLOY_URL = import.meta.env.VITE_BASE_URL || "";

export const postsQueryOptions = () =>
  queryOptions({
    queryKey: ["posts"],
    queryFn: () =>
      fetch(`${DEPLOY_URL}/api/posts`)
        .then((r) => {
          if (!r.ok) {
            throw new Error("Failed to fetch posts");
          }
          return r.json() as Promise<PostType[]>;
        })
        .catch(() => {
          throw new Error("Failed to fetch posts");
        }),
  });

export const postsUploadOptions = (postData) =>
  queryOptions({
    queryKey: ["posts", "upload", postData],
    queryFn: () =>
      fetch(`${DEPLOY_URL}/api/posts`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(postData),
      }).then(async (r) => {
        if (!r.ok) {
          const errorData = await r.json();
          throw new Error(errorData.error || "Failed to upload post");
        }
        return r.json() as Promise<PostType>;
      }),
  });

export const postQueryOptions = (id: string) =>
  queryOptions({
    queryKey: ["posts", id],
    queryFn: () =>
      fetch(`${DEPLOY_URL}/api/posts/${id}`)
        .then((r) => {
          if (!r.ok) {
            throw new Error("Failed to fetch posts");
          }
          return r.json() as Promise<PostType[]>;
        })
        .catch(() => {
          throw new Error("Failed to fetch posts");
        }),
  });

export const fetchPost = createServerFn({ method: "GET" })
  .validator((d: string) => d)
  .handler(async ({ data }) => {
    console.info(`Fetching post with id ${data}...`);
    const res = await fetch(
      `https://jsonplaceholder.typicode.com/posts/${data}`
    );
    if (!res.ok) {
      if (res.status === 404) {
        throw notFound();
      }

      throw new Error("Failed to fetch post");
    }

    const post = (await res.json()) as PostType;

    return post;
  });

export const fetchPosts = createServerFn({ method: "GET" }).handler(
  async () => {
    console.info("Fetching posts...");
    const res = await fetch("https://jsonplaceholder.typicode.com/posts");
    if (!res.ok) {
      throw new Error("Failed to fetch posts");
    }

    const posts = (await res.json()) as Array<PostType>;

    return posts;
  }
);
