# Editing the help page

The public help page lives at `/help`. It answers quick, frequently asked questions about ViteSakuga: accounts, uploads, voting, edit suggestions, reporting, and keyboard shortcuts. Visitors do not need an account.

The page renders a single Markdown document from `src/content/help/help.md`. There is no database, admin editor, or article registry — edit the file and redeploy.

## Editing rules

- The page supplies the main heading; start sections at `##` so each question reads as a section.
- Keep answers short and link out for depth instead of duplicating wiki articles, e.g. `[Roles and points](/wiki/roles-and-points)`.
- Use root-relative links for site pages (`/wiki`, `/news`, `/posts`). Raw HTML is ignored; Markdown renders through React without HTML injection.

## Keeping it accurate

When a product change makes an answer stale, update `help.md` in the same change as the feature. The registry invariants for wiki and news articles do not apply here; there is no dedicated test for the help body.

## When to use the help page vs the wiki

- Help: quick answers, one paragraph each, optimized for “I’m stuck right now”.
- Wiki: long-form explanations of how and why the product works (see [Publishing the wiki](./wiki.md)).
- News: dated announcements of what changed (see [Publishing news](./news.md)).
