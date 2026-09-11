import { createFileRoute, Link } from "@tanstack/react-router";
import Markdown from "react-markdown";
import { EditorialShell } from "src/components/EditorialShell";
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
    <EditorialShell
      description="Quick answers about using the site and fixing problems."
      eyebrow="ViteSakuga support"
      title="Help"
    >
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
    </EditorialShell>
  );
}
