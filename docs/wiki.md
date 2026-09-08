# Publishing the wiki

ViteSakuga’s public wiki lives at `/wiki`. Each article has a shareable `/wiki/<slug>` URL. The index groups articles by category, in registry order. Visitors do not need an account.

Wiki articles are evergreen: they have no dates and describe how the product works today, unlike [news posts](./news.md), which are dated announcements. For time-sensitive answers, use the news feed; for stable explanations, use the wiki. The `/help` page covers quick FAQ-style answers and should link into wiki articles instead of duplicating them.

## Add an article

1. Write the article in `src/content/wiki/<slug>.md` using standard Markdown.
2. Register it in `src/lib/wiki/wiki.ts` with a unique lowercase, hyphenated slug, a title, a short summary, a category, and a `loadBody` import matching the Markdown file. Copy an existing entry as a starting point.
3. Preview `/wiki` and `/wiki/<slug>`, then deploy through the usual workflow.

Categories are a small, stable set (currently “About the site”, “Using the site”, “Contributing”). Reuse an existing category rather than inventing a one-off label; the registry order also controls the order of categories and articles on the index.

## Writing rules

The page supplies the title as its main heading. Start article sections at `##`. Paragraphs, lists, tables, links, quotes, images, and fenced code blocks are supported. Raw HTML is ignored; Markdown renders through React without HTML injection.

- Use root-relative links for site pages, e.g. `[Search operators](/wiki/search-operators)`.
- Cross-link related wiki articles and the help page so readers never dead-end.
- Keep facts in sync with the code; `docs/features.md` is the inventory to check against.

Only articles registered in `wikiArticles` are reachable. Keep drafts unregistered; their files are not imported into the published app. There is no database, admin editor, or per-article publication schedule: every registered article is published when the deployment goes live.

## Updating or removing

Edit the Markdown or metadata and redeploy to correct an article. Keep published slugs stable so shared links continue to work. Remove its registry entry and redeploy to unpublish an article; its URL then returns a not-found page.

`src/lib/wiki/wiki.test.ts` guards the registry invariants: unique URL-safe slugs, complete metadata, loadable bodies, and no duplicate main heading.
