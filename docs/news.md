# Publishing news

ViteSakuga’s public news feed lives at `/news`. Each article has a shareable `/news/<slug>` URL. The feed lists announcements newest first, with the slug as a stable tie-breaker for posts on the same date. Visitors do not need an account.

## Add an announcement

1. Write the article in `src/content/news/<slug>.md` using standard Markdown.
2. Register it in `src/lib/news/news.ts` with a unique lowercase, hyphenated slug, title, short summary, calendar date (`YYYY-MM-DD`), and a `loadBody` import matching the Markdown file. Copy the welcome entry as a starting point.
3. Preview `/news` and `/news/<slug>`, then deploy through the usual workflow.

The page supplies the title as its main heading. Start article sections at `##`. Paragraphs, lists, links, quotes, images, and fenced code blocks are supported. Use root-relative links for site pages, e.g. `[Browse posts](/posts)`. Raw HTML is ignored; Markdown renders through React without HTML injection.

Only articles registered in `newsPosts` are reachable. Keep drafts unregistered; their files are not imported into the published app. Dates control ordering and display, **not scheduled publication**: every registered post is published when the deployment goes live. Article bodies load on demand, so the feed does not download every article.

Edit the Markdown or metadata and redeploy to correct a post. Keep published slugs stable so shared links continue to work. Remove its registry entry and redeploy to unpublish a post; its URL then returns a not-found page. There is no database, admin editor, or RSS endpoint.
