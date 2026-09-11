import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import Markdown from "react-markdown";
import { EditorialShell } from "src/components/EditorialShell";
import { formatNewsDate, newsPosts } from "src/lib/news/news";
import { seo } from "src/utils/seo";

export const Route = createFileRoute("/news/$slug")({
  loader: async ({ params }) => {
    const post = newsPosts.find((entry) => entry.slug === params.slug);
    if (!post) throw notFound();
    const { loadBody, ...metadata } = post;
    return { ...metadata, body: await loadBody() };
  },
  head: ({ loaderData }) => ({
    meta: seo({
      title: loaderData
        ? `${loaderData.title} · ViteSakuga`
        : "Update not found · ViteSakuga",
      description:
        loaderData?.summary ?? "This ViteSakuga update could not be found.",
    }),
  }),
  notFoundComponent: NewsNotFound,
  component: NewsArticle,
});

function NewsNotFound() {
  return (
    <div className="mx-auto max-w-3xl px-5 py-12">
      <h1 className="text-3xl font-bold">Update not found</h1>
      <p className="my-4">
        This update doesn’t exist or is no longer published.
      </p>
      <Link className="text-blue-600 underline dark:text-blue-400" to="/news">
        Back to news
      </Link>
    </div>
  );
}

function NewsArticle() {
  const post = Route.useLoaderData();
  return (
    <EditorialShell
      description={post.summary}
      eyebrow={`ViteSakuga update · ${formatNewsDate(post.date)}`}
      title={post.title}
    >
      <Link
        className="text-sm text-blue-600 hover:underline dark:text-blue-400"
        to="/news"
      >
        <span aria-hidden="true">← </span>All news
      </Link>
      <div className="markdown-prose">
        <Markdown skipHtml>{post.body}</Markdown>
      </div>
    </EditorialShell>
  );
}
