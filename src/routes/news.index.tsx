import { createFileRoute, Link } from "@tanstack/react-router";
import { EditorialShell } from "src/components/EditorialShell";
import { EmptyState } from "src/components/EmptyState";
import { formatNewsDate, newsPosts } from "src/lib/news/news";
import { seo } from "src/utils/seo";

export const Route = createFileRoute("/news/")({
  head: () => ({
    meta: seo({
      title: "News · ViteSakuga",
      description: "New features, improvements, and fixes from ViteSakuga.",
    }),
  }),
  component: NewsPage,
});

function NewsPage() {
  return (
    <EditorialShell
      description="What’s new, what’s better, and what’s fixed."
      eyebrow="ViteSakuga updates"
      title="News"
    >
      {newsPosts.length === 0 ? (
        <EmptyState
          description="Check back soon for news from ViteSakuga."
          title="No updates yet"
        />
      ) : (
        <div className="divide-tone-200 border-tone-200 dark:divide-tone-800 dark:border-tone-800 divide-y border-y">
          {newsPosts.map((post) => (
            <article key={post.slug} className="py-8">
              <time
                dateTime={post.date}
                className="text-tone-600 dark:text-tone-400 text-sm"
              >
                {formatNewsDate(post.date)}
              </time>
              <h2 className="mt-3 text-2xl font-semibold tracking-tight">
                <Link
                  className="hover:text-accent-600 focus-visible:outline-accent-500 dark:hover:text-accent-400 rounded-sm focus-visible:outline-2 focus-visible:outline-offset-4"
                  to="/news/$slug"
                  params={{ slug: post.slug }}
                >
                  {post.title}
                </Link>
              </h2>
              <p className="text-tone-600 dark:text-tone-400 mt-3 leading-7">
                {post.summary}
              </p>
              <Link
                className="text-accent-600 dark:text-accent-400 mt-5 inline-block rounded-sm text-sm font-medium hover:underline focus-visible:outline-2 focus-visible:outline-offset-4"
                to="/news/$slug"
                params={{ slug: post.slug }}
                aria-label={`Read update: ${post.title}`}
              >
                Read update <span aria-hidden="true">→</span>
              </Link>
            </article>
          ))}
        </div>
      )}
    </EditorialShell>
  );
}
