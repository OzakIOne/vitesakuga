import { queryOptions } from "@tanstack/react-query";
import z from "zod";
import { PostsInsert, postsSelectSchema } from "~/auth/db/schema";

export const DEPLOY_URL = import.meta.env.VITE_BASE_URL || "";

export const postsQueryOptions = () =>
  queryOptions({
    queryKey: ["posts"],
    queryFn: () =>
      fetch(`${DEPLOY_URL}/api/posts`).then(async (r) => {
        const data = await r.json();
        console.log("prout data", data);
        const parsed = z.array(postsSelectSchema).safeParse(data);
        if (!parsed.success)
          throw new Error(
            `There was an error processing the search results ${parsed.error}`
          );
        return parsed.data;
      }),
  });

export const postsUploadOptions = (postData: PostsInsert) =>
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
        return r.json();
      }),
  });

export const postQueryOptions = (id: string) =>
  queryOptions({
    queryKey: ["posts", id],
    queryFn: () =>
      fetch(`${DEPLOY_URL}/api/posts/${id}`)
        .then((r) => {
          return r.json();
        })
        .catch(() => {
          throw new Error("Failed to fetch post");
        }),
  });
