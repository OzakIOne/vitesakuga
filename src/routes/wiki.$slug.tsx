import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import Markdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { EditorialShell } from "src/components/EditorialShell";
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
    <EditorialShell
      description={article.summary}
      eyebrow={`ViteSakuga knowledge base · ${article.category}`}
      title={article.title}
    >
      <Link
        className="text-sm text-blue-600 hover:underline dark:text-blue-400"
        to="/wiki"
      >
        <span aria-hidden="true">← </span>All wiki articles
      </Link>
      <div className="markdown-prose">
        <Markdown remarkPlugins={[remarkGfm]} skipHtml>
          {article.body}
        </Markdown>
      </div>
    </EditorialShell>
  );
}
