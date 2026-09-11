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
        <div className="divide-y divide-gray-200 border-y border-gray-200 dark:divide-gray-800 dark:border-gray-800">
          {newsPosts.map((post) => (
            <article key={post.slug} className="py-8">
              <time
                dateTime={post.date}
                className="text-sm text-gray-600 dark:text-gray-400"
              >
                {formatNewsDate(post.date)}
              </time>
              <h2 className="mt-3 text-2xl font-semibold tracking-tight">
                <Link
                  className="rounded-sm hover:text-blue-600 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-blue-500 dark:hover:text-blue-400"
                  to="/news/$slug"
                  params={{ slug: post.slug }}
                >
                  {post.title}
                </Link>
              </h2>
              <p className="mt-3 leading-7 text-gray-600 dark:text-gray-400">
                {post.summary}
              </p>
              <Link
                className="mt-5 inline-block rounded-sm text-sm font-medium text-blue-600 hover:underline focus-visible:outline-2 focus-visible:outline-offset-4 dark:text-blue-400"
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
