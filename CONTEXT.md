# Domain Glossary

Terms used consistently across the codebase. Update this file when new concepts emerge during development.

## Core Entities

**Post** — A video upload with title, description, source URL, tags, related post reference, and video/thumbnail file keys stored in R2. Owned by a User.

**Tag** — A label attached to Posts via the `post_tags` junction table. Has a unique name and a creation timestamp. Tags are resolved by name on upload (upsert).

**Comment** — A text response on a Post, owned by a User. Created with sanitized content.

**User** — An account with email/password auth (Better Auth). Owns Posts and Comments. Has profile fields (name, image).

## Upload Path

**Upload Processor** — Pure functions in `upload.processor.ts` for client-side video work: `analyzeVideo` (mediainfo.js metadata extraction), `generateThumbnails` (mediabunny frame extraction), `generateAutoThumbnails` (5 evenly-spaced frames), `buildFormData` (values → FormData).

**Video Processing** — Client-side hook (`useVideoProcessing`) that owns the MediaInfo WASM lifecycle, video file selection, preview URL, thumbnail generation/capture, and frame rate state. Returns `{ videoFile, previewUrl, frameRate, thumbnails, selectedThumbnailIndex, videoMetadata, selectFile, captureFrame, selectThumbnail, clearFile }`.

**Upload Draft** — Client-side persistence of incomplete upload form data via TanStack DB localStorage collection in `src/lib/db/collections.ts`. Hook: `useUploadDraft` in `src/lib/upload/useUploadDraft.ts` with `{ draft, isLoaded, persist, clear }`.

**Upload Form** — Hook: `useUploadForm` in `src/lib/upload/useUploadForm.ts`. Manages the full upload form state including video processing, thumbnail selection, tag input, and FormData construction.

**Video Metadata** — Technical metadata extracted from video files (codec, resolution, frame rate, duration, bitrate, etc.). Parsed via `VideoMetadataSchema` (Zod).

## Post Detail

**Post Detail** — The full post view combining: post data (title, content, video key, source, related post), user info (name, image), tags, and comments. Fetched via `fetchPostDetail`.

**Related Post** — An optional reference from one Post to another. Stored as `relatedPostId` integer on the posts table.

## Auth

**Session** — Better Auth session with user info. Retrieved via `getSessionEffect`. Required for mutations (update post, delete comment).

**Ownership Guard** — Pattern for checking that the authenticated user owns the resource before allowing mutation. Currently inlined in `PostsService.update` and `CommentsService.delete_`. Steps: get session → fetch resource owner → compare IDs → fail with `UnauthorizedError` or `ForbiddenError`.

## Search & Pagination

**Post Search** — Server-side filtering by query string (title/content ilike), tags (junction table join), date range (today/week/month/all), and sort order (newest/oldest). Returns paginated results with popular tags.

**Popular Tags** — Aggregation query: join post_tags, group by tag, count posts, order by count desc, limit 10. Currently duplicated across 4 service methods.

**Pagination** — Offset-based pagination computed by `computePagination(totalCount, { page, pageSize })`. Returns `{ currentPage, totalPages, hasMore, hasPrevious, offset, limit, total }`.

## Video Conversion

**Convert Machine** — XState state machine for client-side video format conversion using mediabunny. States: idle → file selected → probed → output selected → converting → done/error. Supports passthrough (copy) and transcode modes.

**Output Format** — Conversion target: container (mp4/webm/mkv), optional video/audio codecs, optional custom bitrates. Passthrough options skip re-encoding when input codec is compatible.

## Infrastructure

**R2** — Cloudflare R2 (S3-compatible) object storage for video and thumbnail files. Accessed via AWS SDK S3Client.

**Neon** — Serverless PostgreSQL database. Accessed via Neon HTTP driver (Drizzle) and Neon serverless pool (Kysely).

**PGlite** — In-memory PostgreSQL for tests. Custom Kysely dialect. Used in `makeServiceTestLayer` to build test layers with real DB queries.

**Effect Layer** — Dependency injection pattern used by all domain services. Base layer: KyselyDB + logging + tracing. Auth layer adds AuthService + RequestHeadersService. Service layers compose on top.

## Storage

**StorageModule** — Effect service wrapping R2/S3 operations in `src/lib/storage/storage.module.ts`. Interface defines `uploadVideo(userId, file)`, `uploadThumbnail(userId, file)`, `deleteFile(key)`. Tagged error: `StorageError`. S3 implementation in `storage.s3.ts`; in-memory test layer in `storage.memory.ts` and `storage.test.ts`.

## Pagination

**Pagination** — Offset-based pagination computed by `computePagination(totalCount, { page, pageSize })` in `src/lib/pagination/pagination.ts`. Returns `{ currentPage, totalPages, hasMore, hasPrevious, offset, limit, total }`. Page is 0-indexed internally; `currentPage` is 1-indexed for display.

## Conventions

**Server Function** — TanStack Start `createServerFn` with input validator and handler. Server functions are embedded at the bottom of `*.service.ts` files (not separate `.fn.ts` files). Handler calls `createHandler(effect, serviceLayer, optionalBaseLayer)` which bridges Effect programs to async server functions.

**Query Options** — TanStack Query `queryOptions` factories in `*.queries.ts` files. Keyed by domain + params. Used by routes via `useQuery`/`useSuspenseQuery`.

**Tagged Errors** — Effect `Data.TaggedError` classes in `errors.ts`. Pattern: `{ readonly message: string }` plus domain-specific fields. Used for typed error handling in Effect programs.

**TanStack DB Collections** — Client-side reactive collections in `src/lib/db/collections.ts`. `tagsCollection` and `usersCollection` sync server data eagerly via `@tanstack/query-db-collection`. `commentDraftsCollection` and `uploadDraftCollection` use localStorage for draft persistence.
