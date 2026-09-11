import { createFileRoute, Link } from "@tanstack/react-router";
import { EditorialShell } from "src/components/EditorialShell";
import { EmptyState } from "src/components/EmptyState";
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
    <EditorialShell
      description="Evergreen guides about the archive and how to contribute to it."
      eyebrow="ViteSakuga knowledge base"
      title="Wiki"
    >
      {wikiArticles.length === 0 ? (
        <EmptyState
          description="Check back soon for permanent guides from ViteSakuga."
          title="No wiki articles yet"
        />
      ) : (
        <div className="divide-y divide-gray-200 border-y border-gray-200 dark:divide-gray-800 dark:border-gray-800">
          {wikiCategories().map((category) => (
            <section key={category} aria-label={category} className="py-8">
              <h2 className="text-sm font-semibold tracking-wide text-gray-500 uppercase dark:text-gray-400">
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
    </EditorialShell>
  );
}
