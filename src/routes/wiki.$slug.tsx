import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import Markdown from "react-markdown";
import { findWikiArticle } from "src/lib/wiki/wiki";
import { seo } from "src/utils/seo";

export const Route = createFileRoute("/wiki/$slug")({
  loader: async ({ params }) => {
    const article = findWikiArticle(params.slug);
    if (!article) throw notFound();
    const { loadBody, ...metadata } = article;
    return { ...metadata, body: await loadBody() };
  },
  head: ({ loaderData }) => ({
    meta: seo({
      title: loaderData
        ? `${loaderData.title} · ViteSakuga`
        : "Article not found · ViteSakuga",
      description:
        loaderData?.summary ??
        "This ViteSakuga wiki article could not be found.",
    }),
  }),
  notFoundComponent: WikiNotFound,
  component: WikiArticlePage,
});

function WikiNotFound() {
  return (
    <div className="mx-auto max-w-3xl px-5 py-12">
      <h1 className="text-3xl font-bold">Article not found</h1>
      <p className="my-4">
        This article doesn’t exist or is no longer published.
      </p>
      <Link className="text-blue-600 underline dark:text-blue-400" to="/wiki">
        Back to the wiki
      </Link>
    </div>
  );
}

function WikiArticlePage() {
  const article = Route.useLoaderData();
  return (
    <article className="mx-auto max-w-3xl px-5 py-12 sm:py-20">
      <Link
        className="text-sm text-blue-600 hover:underline dark:text-blue-400"
        to="/wiki"
      >
        <span aria-hidden="true">← </span>All wiki articles
      </Link>
      <header className="mt-8 mb-10 border-b border-gray-200 pb-8 dark:border-gray-800">
        <p className="text-sm text-gray-600 dark:text-gray-400">
          {article.category}
        </p>
        <h1 className="mt-3 text-3xl font-bold tracking-tight sm:text-4xl">
          {article.title}
        </h1>
        <p className="mt-4 text-lg leading-8 text-gray-600 dark:text-gray-400">
          {article.summary}
        </p>
      </header>
      <div className="markdown-prose">
        <Markdown skipHtml>{article.body}</Markdown>
      </div>
    </article>
  );
}
