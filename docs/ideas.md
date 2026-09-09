# Product ideas — ViteSakuga

Ideas grounded in the current ViteSakuga product: a Sakugabooru-style archive for animation clips and manga panels, with strong search, upload tooling, community review, playlists, and staff workflows.

This list was prepared from `docs/features.md`, `CONTEXT.md`, the current routes/services, and the existing README TODOs. Priority is relative product value and implementation leverage, not a fixed roadmap.

## Product direction

ViteSakuga already has much of the hard foundation: typed Effect services, direct-to-storage video uploads, client-side media processing, structured post metadata, moderation primitives, points, notifications, and a virtualized feed. The best next features should expose those capabilities to users and make the archive easier to curate and revisit.

## Highest-leverage ideas

### 1. Public wiki-edit workflow — P0

The edit-suggestion service, approval rules, notifications, and history already exist, but users cannot submit suggestions from the post page.

Smallest useful version:

- Add a `Suggest an edit` action to post details.
- Show a field-level diff before submission.
- Let uploaders and eligible contributors approve or reject suggestions.
- Show pending, applied, and rejected history on the post.
- Notify the suggester when a decision is made.

This turns the existing wiki model into a visible community feature and improves metadata quality without giving every user direct write access.

### 2. Safe video replacement for uploaders — P0

Video revisions, restore, retention, and storage garbage collection are already implemented server-side. Add the owner-facing replacement screen.

The flow should validate and preview the new file, preserve the post identity and discussion, make the revision visible, and provide staff rollback. A replacement should not silently alter title, tags, episode information, votes, or comments.

### 3. Multi-image posts and manga galleries — P0

`post_images` already stores ordered images and the server schema supports up to five, while the current upload UI exposes one image.

Add multi-file selection, thumbnail/reorder controls, per-image validation, and a detail-page gallery with keyboard navigation. Preserve the first image as the default thumbnail. This completes an existing data-model promise and makes the manga/panel use case substantially better.

### 4. Series and episode hubs — P1

Posts already carry `animeTitle`, `sourceType`, season, episode, volume, chapter, and a related-post link. Use those fields to build an archive view instead of leaving them as isolated labels.

Possible experience:

- A series page grouped by season and episode.
- Previous/next episode navigation from post detail.
- A chapter or volume view for manga posts.
- A “more from this series” panel using the same search/filter primitives.
- Clear handling for incomplete or conflicting metadata.

This is a natural differentiator for an archive: users can study a sequence, not only browse individual clips.

### 5. Duplicate and quality triage — P1

Reports and moderation queues exist, and the README already calls out duplicate detection and low-quality reporting. Start with explainable signals rather than an opaque classifier.

MVP signals could include exact file hash, duration, dimensions, codec, and a perceptual thumbnail or frame signature. Surface “possible duplicate” candidates to uploaders and moderators, with links to compare both posts. Add report reasons for duplicate, broken media, misleading metadata, and low quality.

Keep the final decision human-controlled. A similarity score should create a review task, never delete or merge content automatically.

## Discovery and archive value

### 6. Saved searches, followed tags, and followed users — P1

Search state already lives in URL parameters, tags and users are queryable, and notifications already have an inbox. Let signed-in users save a search or follow a tag/user, then notify them about new matching posts.

Start with in-app notifications and a small limit on active subscriptions. Add email later only if notification preferences and unsubscribe behavior are clear.

### 7. Intentional discovery feeds — P1

Add opt-in views such as `Trending`, `Most liked this week`, `New from followed tags`, `Under-seen gems`, and `Random study queue`. Keep the current chronological feed as the stable default.

The points ledger and vote counts can support early ranking experiments, but ranking should be transparent: show the time window and the signals used. Avoid making points a proxy for content quality without moderation safeguards.

### 8. Canonical tags, aliases, and tag wiki pages — P1

The current free-text tag system and popular-tag aggregation are a good base. Add canonical names, aliases, optional implications, descriptions, and staff-maintained tag pages.

This would reduce duplicate spellings, make autocomplete more useful, and let users understand what a tag means before searching it. Apply normalization at write time while keeping the user-visible original input pleasant.

### 9. Timestamped video notes — P2

The player already supports frame-by-frame keyboard navigation. Let comments optionally attach to a timestamp or frame, then seek the player when a note is selected.

Useful details include a visible timestamp, one-click copy of the current frame time, and a distinction between general discussion and media-specific notes. This would make the site useful for animation study and production reference, not only collection.

### 10. RSS and lightweight public feeds — P2

There is no application REST API today, but public posts, tags, users, and playlists are already well-defined. Add read-only RSS/Atom feeds for the newest posts, a tag, a user, and a public playlist.

This is a low-surface-area way to make the archive followable without committing to a large public API. Add caching, pagination limits, and explicit handling for private or deleted content.

## Contributor and creation workflows

### 11. Batch upload workspace — P1

The upload form already has persistent drafts, local video analysis, generated thumbnails, and direct-to-R2 upload. Turn it into a small queue for several files.

Good first features:

- Reuse metadata and tags across a batch.
- Show per-file validation and upload progress.
- Keep failed items retryable without losing completed items.
- Suggest episode/chapter increments when the user confirms them.
- Detect likely duplicates before upload confirmation.

This improves serious contributors’ throughput while reusing the current upload processor instead of creating a second pipeline.

### 12. Convert-for-upload handoff — P2

The browser converter already supports passthrough and transcoding. Add a clear handoff from `/convert` to `/upload` for files that need normalization, carrying the converted file and a fresh draft into the upload form.

The handoff should explain when conversion is useful, keep conversion entirely local, and warn users before replacing a source file.

### 13. Contributor profile and reputation history — P2

Roles, points, promotions, posts, playlists, and notifications already form the pieces of a contributor identity. Add a public profile section showing contribution counts, curated playlists, accepted edits, and earned status badges.

Keep private security data and raw moderation history out of the public view. Show points as context and motivation, not as a universal quality score.

### 14. Local image enhancement tool — P2

The README mentions a WASM image upscaler. If pursued, make it an opt-in, browser-only tool for manga panels: compare original and enhanced output, download the result, and never overwrite the archived original automatically.

Treat this as a utility around the archive, not as an automatic upload transformation. Bundle size, browser support, and processing time need explicit limits.

## Trust, quality, and launch essentials

### 15. Moderation case view — P1

The admin queues cover reports, suggestions, promotions, roles, and storage, but a moderator still benefits from one focused case view. Include the reported post, report reason, related duplicate candidates, edit history, video revisions, prior decisions, and an auditable resolution action.

Make queue state explicit: open, in review, resolved, dismissed, or escalated. This reduces repeated investigation and makes staff decisions easier to explain.

### 16. Accessibility and media resilience pass — P0 before launch

The README already lists accessibility as unfinished. Make it a product milestone: keyboard-complete upload and gallery flows, visible focus, reduced-motion behavior, meaningful labels, captions for controls, error recovery, and usable layouts at narrow widths.

Also test broken thumbnails, slow storage, unsupported codecs, partially completed uploads, and empty search results. The app’s archive value depends on users being able to inspect media reliably.

### 17. Account trust and notification controls — P0 before launch

Email verification is now required for password signups: Better Auth sends a
short-lived OTP through Resend before creating a usable session. Keep password
recovery and other account-security messages covered by the same deliverability
and notification policy before launch.

Alongside that decision, add notification preferences for mentions, edit suggestions, moderation outcomes, and followed searches. Users should be able to mute a noisy category without losing security-critical account messages.

## Suggested sequence

1. Ship the public edit-suggestion UI, video replacement UI, multi-image posts, and the accessibility/media-resilience pass.
2. Add series/episode hubs and duplicate-quality triage to improve archive quality and navigation.
3. Add saved searches/follows, intentional discovery feeds, and canonical tags once notification preferences are in place.
4. Add batch upload, timestamped notes, public feeds, and optional contributor/reputation features as the core archive gets daily use.

The common thread: expose existing domain capabilities first, then add discovery loops that reward careful curation without making moderation or ranking opaque.
