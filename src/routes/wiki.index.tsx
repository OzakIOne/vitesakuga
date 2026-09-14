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
        <div className="divide-tone-200 border-tone-200 dark:divide-tone-800 dark:border-tone-800 divide-y border-y">
          {wikiCategories().map((category) => (
            <section key={category} aria-label={category} className="py-8">
              <h2 className="text-tone-500 dark:text-tone-400 text-sm font-semibold tracking-wide uppercase">
                {category}
              </h2>
              {wikiArticles
                .filter((article) => article.category === category)
                .map((article) => (
                  <article key={article.slug} className="mt-5 first:mt-6">
                    <h3 className="text-2xl font-semibold tracking-tight">
                      <Link
                        className="hover:text-accent-600 focus-visible:outline-accent-500 dark:hover:text-accent-400 rounded-sm focus-visible:outline-2 focus-visible:outline-offset-4"
                        to="/wiki/$slug"
                        params={{ slug: article.slug }}
                      >
                        {article.title}
                      </Link>
                    </h3>
                    <p className="text-tone-600 dark:text-tone-400 mt-2 leading-7">
                      {article.summary}
                    </p>
                    <Link
                      className="text-accent-600 dark:text-accent-400 mt-3 inline-block rounded-sm text-sm font-medium hover:underline focus-visible:outline-2 focus-visible:outline-offset-4"
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
