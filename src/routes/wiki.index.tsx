import { createFileRoute, Link } from "@tanstack/react-router";
import { wikiArticles, wikiCategories } from "src/lib/wiki/wiki";
import { seo } from "src/utils/seo";

export const Route = createFileRoute("/wiki/")({
  head: () => ({
    meta: seo({
      title: "Wiki · ViteSakuga",
      description:
        "Guides and references for using and contributing to ViteSakuga.",
    }),
  }),
  component: WikiPage,
});

function WikiPage() {
  return (
    <div className="mx-auto max-w-3xl px-5 py-12 sm:py-20">
      <header className="mb-12">
        <p className="mb-3 text-sm font-medium text-blue-600 dark:text-blue-400">
          ViteSakuga knowledge base
        </p>
        <h1 className="text-4xl font-bold tracking-tight sm:text-5xl">Wiki</h1>
        <p className="mt-4 text-lg text-gray-600 dark:text-gray-400">
          Evergreen guides about the archive and how to contribute to it.
        </p>
      </header>
      {wikiArticles.length === 0 ? (
        <p className="text-gray-600 dark:text-gray-400">
          No wiki articles yet. Check back soon.
        </p>
      ) : (
        <div className="divide-y divide-gray-200 border-y border-gray-200 dark:divide-gray-800 dark:border-gray-800">
          {wikiCategories().map((category) => (
            <section key={category} aria-label={category} className="py-8">
              <h2 className="text-sm font-semibold tracking-wide text-gray-500 uppercase dark:text-gray-500">
                {category}
              </h2>
              {wikiArticles
                .filter((article) => article.category === category)
                .map((article) => (
                  <article key={article.slug} className="mt-5 first:mt-6">
                    <h3 className="text-2xl font-semibold tracking-tight">
                      <Link
                        className="rounded-sm hover:text-blue-600 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-blue-500 dark:hover:text-blue-400"
                        to="/wiki/$slug"
                        params={{ slug: article.slug }}
                      >
                        {article.title}
                      </Link>
                    </h3>
                    <p className="mt-2 leading-7 text-gray-600 dark:text-gray-400">
                      {article.summary}
                    </p>
                    <Link
                      className="mt-3 inline-block rounded-sm text-sm font-medium text-blue-600 hover:underline focus-visible:outline-2 focus-visible:outline-offset-4 dark:text-blue-400"
                      to="/wiki/$slug"
                      params={{ slug: article.slug }}
                      aria-label={`Read article: ${article.title}`}
                    >
                      Read article <span aria-hidden="true">→</span>
                    </Link>
                  </article>
                ))}
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
