import { createFileRoute, Link } from "@tanstack/react-router";
import Markdown from "react-markdown";
import { seo } from "src/utils/seo";

export const Route = createFileRoute("/help")({
  loader: () =>
    import("src/content/help/help.md?raw").then((m) => ({
      body: m.default,
    })),
  head: () => ({
    meta: seo({
      title: "Help · ViteSakuga",
      description:
        "Quick answers about accounts, uploads, voting, and reporting on ViteSakuga.",
    }),
  }),
  component: HelpPage,
});

function HelpPage() {
  const { body } = Route.useLoaderData();
  return (
    <div className="mx-auto max-w-3xl px-5 py-12 sm:py-20">
      <header className="mb-12">
        <p className="mb-3 text-sm font-medium text-blue-600 dark:text-blue-400">
          ViteSakuga support
        </p>
        <h1 className="text-4xl font-bold tracking-tight sm:text-5xl">Help</h1>
        <p className="mt-4 text-lg text-gray-600 dark:text-gray-400">
          Quick answers about using the site and fixing problems.
        </p>
      </header>
      <div className="markdown-prose">
        <Markdown skipHtml>{body}</Markdown>
      </div>
      <div className="mt-12 flex flex-wrap gap-x-8 gap-y-3 border-t border-gray-200 pt-8 text-sm dark:border-gray-800">
        <Link
          className="font-medium text-blue-600 hover:underline focus-visible:outline-2 focus-visible:outline-offset-4 dark:text-blue-400"
          to="/wiki"
        >
          Browse the wiki <span aria-hidden="true">→</span>
        </Link>
        <Link
          className="font-medium text-blue-600 hover:underline focus-visible:outline-2 focus-visible:outline-offset-4 dark:text-blue-400"
          to="/news"
        >
          See what’s new <span aria-hidden="true">→</span>
        </Link>
      </div>
    </div>
  );
}
