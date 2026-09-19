# Database Conventions (Drizzle ORM & Kysely)

This document outlines the conventions and best practices for database interactions within the ViteSakuga project, utilizing Drizzle ORM and Kysely.

---

## Location

- Drizzle ORM table schemas: `src/lib/db/schema/` (auth tables in `auth.schema.ts`, domain tables in `sakuga.schema.ts`)
- Drizzle Kit migration files: `drizzle/` at the repo root (timestamped folders with auto-generated SQL, snapshots, and journal)
- Database configuration: `src/lib/db/pool.ts` (Neon serverless, or local `pg` when `DATABASE_DRIVER=local`), `src/lib/db/kysely.ts` (Kysely setup)

## Kysely Client

- Raw Kysely instance in `src/lib/db/kysely.ts` using Kysely `PostgresDialect` over the pool from `pool.ts` (Neon serverless, or local `pg` when `DATABASE_DRIVER=local`)
- `DB` type derived from Drizzle schema definitions via `Kyselify`; `posts.version` and `post_edits.basePostVersion` support optimistic concurrency checks
- Effect wrapper via `KyselyDB` context tag in `src/lib/db/context.ts` — all domain services inject this
- `media_operations` and `media_objects` form the durable lifecycle registry. Mutations claim a user-scoped operation key, persist a request fingerprint and fence, and replay terminal results. Object deletion uses durable `deleting`/`deleted` tombstones; remote storage I/O happens only after the database transition commits.
- Lifecycle timestamps in these tables use PostgreSQL `timestamp with time zone` and represent instants. Pass and compare JavaScript `Date` values directly; never compensate for the process timezone with manual offsets.
- Lifecycle integration lives in `src/lib/lifecycle/lifecycle.service.ts`; use its transaction helpers to combine post/reference writes with operation completion and version CAS in one short database transaction. Never hold that transaction open during R2/RustFS calls.
- EffectKysely utility (`src/lib/effect/effect.utils.ts`) adapts Kysely queries into Effect programs with `SqlError` and `SqlNoFirstResult` tagged errors

## Drizzle Schemas

- Drizzle ORM table definitions in `src/lib/db/schema/`
- Barrel re-export from `src/lib/db/schema/index.ts`
- Effect Schema insert/select schemas defined in `sakuga.utils.ts` and `auth.schema.ts`
- Used for Kysely type inference (not for query building — domain services use raw Kysely)
- Domain tables include `tags`, `posts`, `postImages`, `postTags`, `tagFollows`, `postVotes`, `postReports`, `playlists`, `playlistPosts`, `comments`, `commentMentions`, `pointsLedger`, `promotionReviews`, `notifications`, `postEdits`, `postEditApprovals`, `videoRevisions`, `mediaOperations`, and `mediaObjects`

## Effect Layer Pattern

- All database access flows through `KyselyDB` Effect context tag
- Layer factories in `src/lib/db/layer-factories.server.ts`:
  - `makeDBLayer()` — provides `KyselyDB` + `StorageLive` + logging + tracing (uses PGlite when `DATABASE_DRIVER=pglite`)
  - `makeAuthLayer()` — provides `KyselyDB` + `AuthService` + `RequestHeadersService`
  - `makeMiddlewareLayer()` — resolves headers from request context
- Test layer via `PGliteDialect` (`src/lib/db/pglite-driver.ts`), `makeServiceTestLayer` in test utils (includes RustFS storage), and `createE2EKysely` in `src/lib/db/e2e-db.ts` — service tests use in-memory PGlite and migrations from root `drizzle/`; e2e uses local Postgres + RustFS through the Playwright web server

## Migrations

- Follow Drizzle Kit migration workflow via `nub run db generate`, `nub run db push`, `nub run db migrate` (stage-aware: `STAGE=local|dev|prod nub run db <command>`)

## TanStack DB Collections

- Client-side collections in `src/lib/db/collections.ts` using `@tanstack/react-db` and `@tanstack/query-db-collection`
- Sync tag data into a reactive collection: `tagsCollection`
- Load the public user directory through its server route loader so `/users` is
  present in the initial SSR response; do not duplicate that list in a browser-only
  collection.
- Local storage collections for drafts: `commentDraftsCollection`, `uploadDraftCollection`
