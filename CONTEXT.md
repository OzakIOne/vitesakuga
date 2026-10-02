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

**Presigned Upload** — `createVideoUploadUrl` server fn mints a 15-min presigned PUT scoped to `videos/_pending/{userId}/{uuid}.{ext}` with a server-pinned Content-Type. The browser PUTs the file, then hands the staging key to `uploadPost`. Size/type are verified at confirm against the stored object (`headFile` + `upload-policy.ts`), which **promotes** it to its final key (`finalizeVideoUpload`: copy out of `_pending/`, best-effort staging delete) before any DB write.

**Staging Namespace & GC** — Unconfirmed direct video uploads use `videos/_pending/`; the R2 lifecycle rule in `infra/alchemy.run.ts` expires staged objects after 48 hours. Durable media-operation and media-object rows track accepted work and reconcile uncertain outcomes, so bucket expiry is not the source of truth for operation state.

**Thumbnail Validation** — Thumbnails transit the Worker and are validated server-side in the confirm validator: `.jpe?g` extension + ≤5 MB + JPEG magic bytes (`file-validation.ts`); stored Content-Type forced to `image/jpeg`.

**Upload Processor** — Pure functions in `upload.processor.ts` for client-side video work: `analyzeVideo` (mediainfo.js metadata extraction), `generateThumbnails` (mediabunny frame extraction), `generateAutoThumbnails` (5 evenly-spaced frames), `buildFormData` (values → FormData).

**Video Processing** — Client-side hook (`useVideoProcessing`) that owns the MediaInfo WASM lifecycle, video file selection, preview URL, thumbnail generation/capture, and frame rate state. Returns `{ videoFile, previewUrl, frameRate, thumbnails, selectedThumbnailIndex, videoMetadata, selectFile, captureFrame, selectThumbnail, clearFile }`.

**Upload Draft** — Client-side persistence of incomplete upload form data via TanStack DB localStorage collection in `src/lib/db/collections.ts`. Hook: `useUploadDraft` in `src/lib/upload/useUploadDraft.ts` with `{ draft, isLoaded, persist, clear }`.

**Upload Form** — Hook: `useUploadForm` in `src/lib/upload/useUploadForm.ts`. Manages the full upload form state including video processing, thumbnail selection, tag input, and FormData construction.

**Video Metadata** — Technical metadata extracted from video files (codec, resolution, frame rate, duration, bitrate, etc.). Parsed via `VideoMetadataSchema` (Effect Schema).

## Post Detail

**Post Detail** — The full post view combining post metadata and media (video or ordered image gallery), user info, tags, comments, votes, edit suggestions/history, and related-post navigation. The server data is fetched through `PostsService.fetchDetail`.

**Related Post** — An optional reference from one Post to another. Stored as `relatedPostId` integer on the posts table.

**Series Hub** — A read-only archive for posts sharing the same `animeTitle`. Episode posts are grouped by season and episode; manga posts are grouped by volume and chapter. Posts with missing or conflicting sequence metadata remain visible in a metadata-review section instead of being silently excluded.

**Series Metadata Status** — `complete` posts can participate in episode/chapter grouping and sequence navigation; `incomplete` posts are missing sequence fields; `conflicting` posts contain incompatible episode/chapter/movie fields. Classification lives in `src/lib/posts/series-hubs.ts`.

## Auth

**Session** — Better Auth session with user info, accessed through `SessionService` (an Effect `Context.Service` in `src/lib/auth/session.effect.ts`, provided by `SessionServiceLive`). Interface: `getSession()` (full session or null), `getUser()` (user or null), and `requireUser(message)` (fails with `UnauthorizedError` when signed out). All mutating services read auth state through this service so the dependency appears in their Effect requirement channel; tests swap in a mocked `AuthService` under the real `SessionServiceLive`.

**Ownership Guard** — Pattern for checking that the authenticated user owns the resource before allowing mutation. The sign-in half is centralized: services call `SessionService.requireUser(message)` first. The ownership half is centralized in `ensureOwned({ resource, selectOwnerId, userId, notFound, forbidden })` (`src/lib/auth/ownership.ts`) — fails with the caller-supplied not-found error when absent, forbidden error when the owner differs; returns the owned row. Used by `PostsService.update`, `CommentsService.delete_`, and (via the private `requireOwnedPlaylist`) every playlist mutation. Vote set/remove needs no explicit guard — ownership is enforced structurally by scoping queries to the authenticated `userId`.

## Search & Pagination

**Post Search** — Server-side filtering by text, included and excluded tags, date range, sort order, discovery view, and numeric image/video dimensions or like count. Returns paginated posts (with vote counts) plus popular tags. See the supported query syntax in [`docs/features.md`](docs/features.md).

**Popular Tags** — Aggregation query: top-10 tags by tagged-post count among a filtered post set. Centralized in `fetchPopularTagsForPosts(db, predicates)` (`src/lib/tags/tags.utils.ts`); callers express scope as predicates over the joined `posts` table (post search, by-tag page, user profiles). `TagsService.popular` deliberately builds its own leftJoin variant so zero-count tags appear.

**Pagination** — Offset-based pagination computed by `computePagination(totalCount, { page, pageSize })`. Returns `{ currentPage, totalPages, hasMore, hasPrevious, offset, limit, total }`.

## Video Conversion

**Convert Machine** — XState state machine for client-side video format conversion using mediabunny. States: idle → file selected → probed → output selected → converting → done/error. Supports passthrough (copy) and transcode modes.

**Output Format** — Conversion target: container (mp4/webm/mkv), optional video/audio codecs, optional custom bitrates. Passthrough options skip re-encoding when input codec is compatible.

## Infrastructure

**R2** — Cloudflare R2 (S3-compatible) object storage for video and thumbnail files. Accessed via AWS SDK S3Client through `storage.adapter.ts`. Local dev and e2e tests use rustfs (S3-compatible) via the `makeRustFSStorageLayer()` configuration of the same adapter instead.

**Neon** — Serverless PostgreSQL database. Accessed via Neon HTTP driver (Drizzle) and Neon serverless pool (Kysely). Local dev (`DATABASE_DRIVER=local`) uses a `pg` Pool against Docker Postgres instead.

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

**StorageModule** — Effect service wrapping video, thumbnail, and gallery-image storage in `src/lib/storage/storage.module.ts`. Besides direct uploads and presigned staging, it supports lifecycle-reserved image/thumbnail writes, deterministic video copies, finalization, and read-only key listing for admin audits. `StorageLive` uses Cloudflare R2; the same S3-protocol adapter targets local RustFS in dev/tests. Durable operation/object ownership and deletion fences live in `src/lib/lifecycle/`; see [`docs/database-conventions.md`](docs/database-conventions.md) for those guarantees.

## Pagination

**Pagination** — Offset-based pagination computed by `computePagination(totalCount, { page, pageSize })` in `src/lib/pagination/pagination.ts`. Returns `{ currentPage, totalPages, hasMore, hasPrevious, offset, limit, total }`. Page is 0-indexed internally; `currentPage` is 1-indexed for display.

## Conventions

**Server Function** — TanStack Start `createServerFn` with input validator and handler. Server functions are embedded at the bottom of `*.service.ts` files (not separate `.fn.ts` files). Handler calls `createHandler(effect, serviceLayer, optionalBaseLayer)` which bridges Effect programs to async server functions.

**Query Options** — TanStack Query `queryOptions` factories in `*.queries.ts` files. Keyed by domain + params. Used by routes via `useQuery`/`useSuspenseQuery`.

**Mutation Feedback** — Client-side feedback module in `src/lib/mutations/mutation-feedback.ts`. `useMutationWithFeedback` wraps `useMutation` with success/error toasts and message fallback; `toastSuccess`/`toastError`/`errorMessage` serve the specialized cases (retry actions). Single place for mutation toasts and error message derivation.

**Tagged Errors** — Effect `Schema.TaggedError` classes in `errors.ts` (schema-backed, serializable). Pattern: `{ readonly message: string }` plus domain-specific fields. Used for typed error handling in Effect programs, with precise error unions in service interfaces.

**TanStack DB Collections** — Client-side reactive collections in `src/lib/db/collections.ts`. `tagsCollection` and `usersCollection` sync server data eagerly via `@tanstack/query-db-collection`. `commentDraftsCollection` and `uploadDraftCollection` use localStorage for draft persistence.
