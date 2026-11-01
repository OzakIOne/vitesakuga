# Domain Glossary

Terms used consistently across the codebase. Update this file when new concepts emerge during development.

## Core Entities

**Post** — A video or ordered image-gallery upload with title, description, source URL, tags, related-post reference, and media stored in R2. Images are recorded in `post_images`; the first image supplies the gallery thumbnail. Owned by a User.

**Tag** — A label attached to Posts via the `post_tags` junction table. Has a unique name and a creation timestamp. Tags are resolved by name on upload (upsert).

**Comment** — A text response on a Post, owned by a User. Created with sanitized content.

**Playlist** — A user-curated, ordered collection of Posts. Stored in the `playlists` table (title, description, public flag) with the `playlist_posts` junction table for membership and ordering. Owned by a User.

**Post Vote** — A like or dislike on a Post by a User. Stored in the `post_votes` table (one vote per user/post; setting a vote replaces the previous one). Rendered as `PostVoteButtons` in post views.

**User** — An account with email/password auth (Better Auth). Owns Posts and Comments. Has profile fields (name, image).

## Upload Path

Uploads are two-phase: videos go **direct-to-R2 via presigned PUTs** (bytes never transit the Worker), then the form confirm promotes them.

**Presigned Upload** — `createVideoUploadUrl` server fn mints a 15-min presigned PUT scoped to `videos/_pending/{userId}/{uuid}.{ext}` with a server-pinned Content-Type. The browser PUTs the file, then hands the staging key to `uploadPost`. At confirm, `LifecycleService.verifyStagedVideo` (implemented in `src/lib/lifecycle/staged-video.ts`) checks the key belongs to the caller, heads the stored object and validates size, type and ETag through `upload-policy.ts`, discarding invalid objects. `LifecycleService.copyVideoForPost` (new post) or `replaceVideo` (replacement) then copies it to its final `media/video/…` key, pinned to the verified ETag, before any DB write. The staging object is discarded only after the post commits.

**Staging Namespace & GC** — Unconfirmed direct video uploads use `videos/_pending/`; the R2 lifecycle rule in `infra/alchemy.run.ts` expires staged objects after 48 hours. Durable media-operation and media-object rows track accepted work and reconcile uncertain outcomes, so bucket expiry is not the source of truth for operation state.

**Managed Media Protocol** — `LifecycleService` owns managed image/thumbnail writes, staged-video copies, replacement commits, and fenced deletion. Every idempotent media mutation enters through `LifecycleService.runOperation`, which fingerprints the request, claims the user-scoped operation key, replays a terminal result decoded by its per-kind schema (an undecodable or missing result fails with `OperationReplayError`), and hands `run` a bound `operation` whose `finish(trx, result)` completes it inside the caller's transaction. A run that fails before finishing stays retryable. Writes are reserved and prepared before S3 I/O; uncertain outcomes stay reconcilable. Video replacement copies outside the database transaction, then atomically marks the object ready, archives the previous video, checks the Post version, and completes the operation. `deleteObject` rechecks Post/image/revision references before committing a deletion tombstone; reconciliation retries a tombstoned remote delete.

**Thumbnail Validation** — Thumbnails transit the Worker and are validated server-side in the confirm validator: `.jpe?g` extension + ≤5 MB + JPEG magic bytes (`file-validation.ts`); stored Content-Type forced to `image/jpeg`.

**Upload Processor** — Pure functions in `upload.processor.ts` for client-side video work: `analyzeVideo` (mediainfo.js metadata extraction), `generateThumbnails` (mediabunny frame extraction), `generateAutoThumbnails` (5 evenly-spaced frames), `buildFormData` (values → FormData).

**Video Processing** — Client-side hook (`useVideoProcessing`) that owns the MediaInfo WASM lifecycle, video file selection, preview URL, thumbnail generation/capture, and frame rate state. Returns `{ videoFile, previewUrl, frameRate, thumbnails, selectedThumbnailIndex, videoMetadata, selectFile, captureFrame, selectThumbnail, clearFile }`.

**Upload Form Coordination** — `useUploadForm` composes the draft, media selection, and submission lifecycle so media snapshots, direct video PUT cancellation, image-dimension preparation, and the operation key stay aligned. `use-upload-media.ts` owns the selected post kind, ordered image files and errors, image preview URLs, and a selection version. Changing kind, files, order, or thumbnail cancels pending upload work; switching kind keeps both media selections available. Image object URLs are released when files leave the selection and when the coordinator unmounts.

**Upload Draft** — Client-side persistence of incomplete upload form data via TanStack DB localStorage collection in `src/lib/db/collections.ts`. Hook: `useUploadDraft` in `src/lib/upload/useUploadDraft.ts` with `{ draft, isLoaded, persist, clear }`.

**Upload Form** — Hook: `useUploadForm` in `src/lib/upload/useUploadForm.ts`. Composes `useUploadDraft`, `use-upload-media.ts`, form validation, media preparation, direct-to-R2 video PUTs, and FormData submission. Image and video fields are cleared when the form prepares the other media kind, so a prior selection cannot leak into the next request.

**Video Metadata** — Technical metadata extracted from video files (codec, resolution, frame rate, duration, bitrate, etc.). Parsed via `VideoMetadataSchema` (Effect Schema).

## Post Detail

**Post Detail** — The full post view combining post metadata and media (video or ordered image gallery), user info, tags, comments, votes, edit suggestions/history, and related-post navigation. The server data is fetched through `PostsService.fetchDetail`.

**Related Post** — An optional reference from one Post to another. Stored as `relatedPostId` integer on the posts table.

**Series Hub** — A read-only archive for posts sharing the same `animeTitle`. Episode posts are grouped by season and episode; manga posts are grouped by volume and chapter. Posts with missing or conflicting sequence metadata remain visible in a metadata-review section instead of being silently excluded.

**Series Metadata Status** — `complete` posts can participate in episode/chapter grouping and sequence navigation; `incomplete` posts are missing sequence fields; `conflicting` posts contain incompatible episode/chapter/movie fields. Classification lives in `src/lib/posts/series-hubs.ts`.

## Auth

**Session** — Better Auth session with user info, accessed through `SessionService` (an Effect `Context.Service` in `src/lib/auth/session.effect.ts`, provided by `SessionServiceLive`). Interface: `getSession()` (full session or null), `getUser()` (user or null), and `requireUser(message)` (fails with `UnauthorizedError` when signed out). All mutating services read auth state through this service so the dependency appears in their Effect requirement channel; tests swap in a mocked `AuthService` under the real `SessionServiceLive`.

**Sign-in Completion** — Password login, email verification, and both manual and conditional passkey sign-in share `useSignInCompletion` (`src/lib/auth/use-sign-in-completion.ts`). It stores the allowlisted return path for a 2FA challenge; after a completed sign-in it clears that value, invalidates the cached user session, then navigates. Signup keeps its separate verified-email gate.

**Ownership Guard** — Pattern for checking that the authenticated user owns the resource before allowing mutation. The sign-in half is centralized: services call `SessionService.requireUser(message)` first. The ownership half is centralized in `ensureOwned({ resource, selectOwnerId, userId, notFound, forbidden })` (`src/lib/auth/ownership.ts`) — fails with the caller-supplied not-found error when absent, forbidden error when the owner differs; returns the owned row. Used by `PostsService.update`, `CommentsService.delete_`, and (via the private `requireOwnedPlaylist`) every playlist mutation. Vote set/remove needs no explicit guard — ownership is enforced structurally by scoping queries to the authenticated `userId`.

## Search & Pagination

**Post Search** — Server-side filtering by text, included and excluded tags, date range, sort order, discovery view, and numeric image/video dimensions or like count. Returns paginated posts (with vote counts) plus popular tags. Count, page rows and popular tags all derive from one scope of predicates in `src/lib/posts/post-page-query.ts`; ordering is per view and applies only to the rows. See the supported query syntax in [`docs/features.md`](docs/features.md).

**Popular Tags** — Aggregation query: top-10 tags by tagged-post count among a filtered post set. Centralized in `fetchPopularTagsForPosts(db, predicates)` (`src/lib/tags/tags.utils.ts`); `fetchPostPage` (`src/lib/posts/post-page-query.ts`) passes it each listing's own scope (post search, by-tag page, user profiles), so popular tags always match the rows. Post search computes them only for the chronological view. `TagsService.popular` deliberately builds its own leftJoin variant so zero-count tags appear.

**Pagination** — Offset-based pagination computed by `computePagination(totalCount, { page, pageSize })`. Returns `{ currentPage, totalPages, hasMore, hasPrevious, offset, limit, total }`.

## Video Conversion

**Convert Machine** — XState state machine for client-side video format conversion using mediabunny. States: idle → file selected → probed → output selected → converting → done/error. Supports passthrough (copy) and transcode modes.

**Output Format** — Conversion target: container (mp4/webm/mkv), optional video/audio codecs, optional custom bitrates. Passthrough options skip re-encoding when input codec is compatible.

## Infrastructure

**R2** — Cloudflare R2 (S3-compatible) object storage for video and thumbnail files. Accessed via AWS SDK S3Client through `storage.adapter.ts`. Local dev and e2e tests use rustfs (S3-compatible) via the `makeRustFSStorageLayer()` configuration of the same adapter instead.

**Neon** — Serverless PostgreSQL database. Accessed via Neon HTTP driver (Drizzle) and Neon serverless pool (Kysely). Local dev (`DATABASE_DRIVER=local`) uses a `pg` Pool against Docker Postgres instead.

**Kysely Schema** — The Kysely `DB` type (`src/lib/db/kysely.ts`) is derived from the Drizzle tables in `src/lib/db/schema/` by `src/lib/db/kysely-schema.ts`, so each Drizzle table definition is the single source for both query builders. Drizzle keys equal database column names.

**PGlite** — In-memory PostgreSQL for tests. Custom Kysely dialect. Used in `makeServiceTestLayer` to build test layers with real DB queries.

**Effect Layer** — Dependency injection pattern used by all domain services. Base layer: KyselyDB + StorageLive + logging + tracing. Auth layer adds AuthService + RequestHeadersService. Service layers compose on top.

## Deployment

Stage env files (`.env` for dev, `.env.production` for prod) provide secrets and
local overrides. The shared stage map in `src/lib/env/stage-config.ts` derives
bucket names, domains, CORS, Worker storage bindings, and deployable client URLs
for both Alchemy and Vite. Client `VITE_*` vars are baked into the bundle at
build time, so each stage still needs its own build script. The public Turnstile
sitekey is the runtime exception: Alchemy binds it to the Worker and
`/api/turnstile` serves it to the auth forms. Build scripts set
`APP_ENV` (which env file nub loads: `development`→`.env`, `test`→`.env.test`,
`production`→`.env.production`) and `NODE_ENV` (React runtime) independently —
nub keys its env-file mode off `APP_ENV`, not `NODE_ENV`.

**Build scripts:**

- **Dev** (`sakuga-dev.ozaki.one`): `nub run infra:deploy` — builds automatically via `nub run build:dev` (`APP_ENV=development NODE_ENV=production vite build --mode development` → nub loads `.env` while React runs in production), then deploys.
- **Prod** (`sakuga.ozaki.one`): `nub run infra:deploy:prod` — builds automatically via `nub run build` (`APP_ENV=production NODE_ENV=production vite build --mode production` → `.env.production`), then deploys.

The deploy scripts (`infra:deploy`, `infra:deploy:prod`) build the correct stage first, then run `scripts/check-prod-build.mjs`, which refuses to upload a bundle whose SSR chunks were compiled with the React dev JSX runtime — that only happens with `NODE_ENV=development vite build`, which 500s every page on Cloudflare (`TypeError: jsxDEV is not a function`, surfaced as `{"status":500,"unhandled":true,"message":"HTTPError"}`). The build scripts make that poisoning impossible; the guard is belt-and-braces for direct `alchemy deploy` invocations.

See [docs/build-environment.md](./docs/build-environment.md) for the full explanation of `NODE_ENV` vs `--mode` and what each impacts.

## Storage

**StorageModule** — Effect service wrapping video, thumbnail, and gallery-image storage in `src/lib/storage/storage.module.ts`. It supports lifecycle-reserved image/thumbnail writes, presigned deterministic video staging, ETag-pinned video copies, and read-only key listing for admin audits. `StorageLive` uses Cloudflare R2; the same S3-protocol adapter targets local RustFS in dev/tests. Durable operation/object ownership and deletion fences live in `src/lib/lifecycle/`; see [`docs/database-conventions.md`](docs/database-conventions.md) for those guarantees.

## Pagination

**Pagination** — Offset-based pagination computed by `computePagination(totalCount, { page, pageSize })` in `src/lib/pagination/pagination.ts`. Returns `{ currentPage, totalPages, hasMore, hasPrevious, offset, limit, total }`. Page is 0-indexed internally; `currentPage` is 1-indexed for display.

## Community Activity

**Community Activity** — The module that decides what a committed domain fact earns and who is notified. Domain services (posts upload, votes, comments, post-edit decisions, promotions) report facts to `CommunityActivityService`: `record` applies points and notifications after the domain change commits, and `recordInTransaction` writes a comment's mention rows inside the comment's own transaction. Points and notifications are best-effort, so a failure there never fails the action that produced it.

## Conventions

**Server Function** — TanStack Start `createServerFn` with input validator and handler. Server functions are embedded at the bottom of `*.service.ts` files (not separate `.fn.ts` files). The `.handler(...)` is `createEndpointHandler({ service, operation, layer, base })` (`src/lib/server-endpoint.ts`), which wraps `createHandler` to bridge a service operation to an async server function. Service classes have no static accessors.

**Fn Context** — The one way client code reaches a domain's server functions. A domain has three client files: `*.fn-context.tsx` (type-only imports from `*.service.ts`, the `XFns` type, the context, and a `useXFns()` accessor that throws without a provider), `*.fns.ts` (the runtime defaults, typed as `XFns`), and `*.hooks.ts` (the only consumers). `src/routes/__root.tsx` provides every domain's defaults. Browser tests pass fakes through the same provider instead of `vi.mock`-ing services. `src/lib/service-import-boundary.test.ts` fails when a `*.fn-context.tsx`, a `*.queries.ts` or a file under `src/components` imports a `*.service` module at runtime; the fix is to move the runtime defaults to `*.fns.ts`.

**Query Options** — Each domain's `*.queries.ts` holds only its TanStack Query key factories, with no service import. Its `queryOptions` factories live in `*.query-options.ts`, which may import server functions because route loaders use them; a factory that a hook is tested through takes its fetcher from `useXFns()` (for example `votesQueryOptions(postId, fetchPostVotes)`). Every cache effect of a mutation, including effects on other domains' keys, lives in the domain's `*.hooks.ts`; components and routes only call hooks. `src/lib/query-cache-boundary.test.ts` fails on a literal `queryKey: [` or a QueryClient write in `src/components` or `src/routes`.

**Mutation Feedback** — Client-side feedback module in `src/lib/mutations/mutation-feedback.ts`. `useMutationWithFeedback` wraps `useMutation` with success/error toasts and message fallback; `toastSuccess`/`toastError`/`errorMessage` serve the specialized cases (retry actions). Single place for mutation toasts and error message derivation.

**Tagged Errors** — Effect `Schema.TaggedError` classes in `errors.ts` (schema-backed, serializable). Pattern: `{ readonly message: string }` plus domain-specific fields. Used for typed error handling in Effect programs, with precise error unions in service interfaces. A tagged error is client-safe only when its class passes `clientSafeAnnotations` (from `src/lib/client-safe-error.ts`) as the third argument to `Schema.TaggedError`; the server-function boundary passes those errors through unchanged and sanitizes every other failure.

**TanStack DB Collections** — Client-side reactive collections in `src/lib/db/collections.ts`. `tagsCollection` and `usersCollection` sync server data eagerly via `@tanstack/query-db-collection`. `commentDraftsCollection` and `uploadDraftCollection` use localStorage for draft persistence.
