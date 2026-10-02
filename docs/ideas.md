# Product ideas — ViteSakuga

Ideas grounded in the current ViteSakuga product: a Sakugabooru-style archive for animation clips and manga panels, with strong search, upload tooling, community review, playlists, and staff workflows.

Reviewed against the product and source on **2026-10-02**. Shipped ideas point to
[`docs/features.md`](features.md); the remaining items are proposals, not a
committed roadmap. Priority is relative product value, not a delivery promise.

## Product direction

ViteSakuga already has much of the hard foundation: typed Effect services, direct-to-storage video uploads, client-side media processing, structured post metadata, moderation primitives, points, notifications, and a virtualized feed. The best next features should expose those capabilities to users and make the archive easier to curate and revisit.

## Highest-leverage ideas

### 1. Post edit-suggestion workflow — shipped

Post details now expose edit proposals with field-level previews, approval and
rejection rules, decision notifications, and proposal history. See the
suggestion entry in [`docs/features.md`](features.md). A future improvement
could make the review experience easier to discover for eligible contributors.

### 2. Safe video replacement for uploaders — P0

Video replacement, revision history, staff restore, retention, and storage
garbage collection are implemented server-side. There is no dedicated public
replacement screen yet; decide whether an owner-facing UI is still wanted
before investing in one. See [`docs/features.md`](features.md).

The flow should validate and preview the new file, preserve the post identity and discussion, make the revision visible, and provide staff rollback. A replacement should not silently alter title, tags, episode information, votes, or comments.

### 3. Multi-image posts and manga galleries — shipped

Posts support up to ten ordered images, with per-image validation, a reorderable
gallery, and the first image used as the thumbnail. See the upload entry in
[`docs/features.md`](features.md). Keep keyboard and narrow-screen behavior in
the ongoing accessibility checks.

### 4. Series and episode hubs — shipped

Series hubs group episode and manga posts and retain incomplete or conflicting
metadata for review instead of silently dropping those posts. See
[`docs/features.md`](features.md) and the series metadata entries in
[`CONTEXT.md`](../CONTEXT.md).

### 5. Duplicate and quality triage — P1

Reports and moderation queues exist. Start with explainable signals rather than an opaque classifier.

MVP signals could include exact file hash, duration, dimensions, codec, and a perceptual thumbnail or frame signature. Surface “possible duplicate” candidates to uploaders and moderators, with links to compare both posts. Add report reasons for duplicate, broken media, misleading metadata, and low quality.

Keep the final decision human-controlled. A similarity score should create a review task, never delete or merge content automatically.

## Discovery and archive value

### 6. Followed users and subscription notifications — partial

Saved searches and followed tags already exist. Following users and notifying
subscribers about new matching posts remain unimplemented; the existing inbox
does not yet provide notification preferences for these subscriptions.

Start with in-app notifications and a small limit on active subscriptions. Add email later only if notification preferences and unsubscribe behavior are clear.

### 7. Intentional discovery feeds — shipped

The opt-in `Trending`, `Most liked this week`, `New from followed tags`,
`Under-seen gems`, and `Random study queue` views are implemented. They show the
window and ranking signals and leave the chronological feed available. See
[`docs/features.md`](features.md).

### 8. Canonical tags, aliases, and tag wiki pages — P1

The current free-text tag system and popular-tag aggregation are a good base. Add canonical names, aliases, optional implications, descriptions, and staff-maintained tag pages.

This would reduce duplicate spellings, make autocomplete more useful, and let users understand what a tag means before searching it. Apply normalization at write time while keeping the user-visible original input pleasant.

### 9. Timestamped video notes — P2

The player already supports frame-by-frame keyboard navigation. Let comments optionally attach to a timestamp or frame, then seek the player when a note is selected.

Useful details include a visible timestamp, one-click copy of the current frame time, and a distinction between general discussion and media-specific notes. This would make the site useful for animation study and production reference, not only collection.

### 10. RSS and lightweight public feeds — P2

There is no public content REST API or RSS/Atom feed. The existing `/api/auth/$`
and `/api/turnstile` routes serve authentication and public captcha
configuration. Add read-only feeds for newest posts, a tag, a user, and a
public playlist if external subscriptions become a product need.

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

No image-enhancement tool exists today. If pursued, make it an opt-in, browser-only tool for manga panels: compare original and enhanced output, download the result, and never overwrite the archived original automatically.

Treat this as a utility around the archive, not as an automatic upload transformation. Bundle size, browser support, and processing time need explicit limits.

## Trust, quality, and launch essentials

### 15. Moderation case view — P1

The admin queues cover reports, suggestions, promotions, roles, and storage, but a moderator still benefits from one focused case view. Include the reported post, report reason, related duplicate candidates, edit history, video revisions, prior decisions, and an auditable resolution action.

Make queue state explicit: open, in review, resolved, dismissed, or escalated. This reduces repeated investigation and makes staff decisions easier to explain.

### 16. Accessibility and media resilience pass — before launch

The October 2026 frontend review records fixes for its audited accessibility
findings. Keep a focused pre-launch check for keyboard operation, visible focus,
reduced motion, meaningful labels, error recovery, and narrow layouts; track any
new findings in the current review index at [`docs/frontend-review.md`](frontend-review.md).

Also test broken thumbnails, slow storage, unsupported codecs, partially completed uploads, and empty search results. The app’s archive value depends on users being able to inspect media reliably.

### 17. Account trust and notification controls — P0 before launch

Email verification is now required for password signups: Better Auth sends a
short-lived OTP through Resend before creating a usable session. Keep password
recovery and other account-security messages covered by the same deliverability
and notification policy before launch.

Alongside that decision, add notification preferences for mentions, edit suggestions, moderation outcomes, and followed searches. Users should be able to mute a noisy category without losing security-critical account messages.

## Suggested sequence

1. Decide whether an owner-facing video replacement UI is needed; replacement itself is already supported by the service.
2. Consider duplicate/quality triage and canonical tag management to improve archive quality.
3. Add followed-user subscriptions and notification preferences if users need those discovery loops.
4. Consider batch upload, timestamped notes, public feeds, and contributor history as product needs emerge.

The common thread: expose existing domain capabilities first, then add discovery loops that reward careful curation without making moderation or ranking opaque.
